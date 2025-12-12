#!/usr/bin/env python3

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, Iterable, List, Mapping, Optional, Tuple

import numpy as np
import pandas as pd
from scipy.cluster.hierarchy import linkage
from sklearn.preprocessing import StandardScaler
from sklearn.manifold import TSNE
from urllib.parse import urlparse

# ---------------------------------------------------------------------------
# Tree structures
# ---------------------------------------------------------------------------


@dataclass
class Node:
    id: int
    name: Optional[str] = None
    url: Optional[str] = None
    children: List["Node"] = field(default_factory=list)


def linkage_to_node_tree(
    Z: np.ndarray,
    labels: Optional[Iterable[Any]] = None,
    image_urls: Optional[Mapping[Any, str]] = None,
) -> Node:
    """
    Build a tree of Node objects from a linkage matrix Z.

    Parameters
    ----------
    Z : np.ndarray
        Linkage matrix from hierarchical clustering.
    labels : iterable, optional
        Labels for each original observation (leaf node).
    image_urls : mapping, optional
        Mapping from labels to image URLs.

    Notes
    -----
    If labels and image_urls are provided:
      - each leaf node (0..n-1) gets .url and .name (filename).
    """
    n = Z.shape[0] + 1  # number of original observations
    nodes: Dict[int, Node] = {i: Node(i) for i in range(n + Z.shape[0])}

    # Initialize leaf nodes with label / URL / filename info
    if labels is not None:
        labels_list = list(labels)
        for obs_idx, label in enumerate(labels_list):
            leaf = nodes[obs_idx]

            if image_urls is not None:
                url = image_urls.get(label)
                leaf.url = url

                if url:
                    parsed = urlparse(url)
                    leaf.name = Path(parsed.path).name
                else:
                    leaf.name = str(label)
            else:
                leaf.name = str(label)

    # Build internal nodes
    for i, row in enumerate(Z):
        child1, child2 = int(row[0]), int(row[1])
        parent = n + i

        nodes[parent].children.append(nodes[child1])
        nodes[parent].children.append(nodes[child2])

    root = nodes[n + Z.shape[0] - 1]
    return root


def node_to_json(node: Node) -> Dict[str, Any]:
    """Convert Node tree to nested dict for JSON serialization."""
    return {
        "id": node.id,
        "name": node.name,
        "url": node.url,
        "children": [node_to_json(child) for child in node.children],
    }


# ---------------------------------------------------------------------------
# Data loading & preprocessing
# ---------------------------------------------------------------------------


def load_tinydb_data(
    json_path: Path,
    agent_name: str,
    score_min: float,
    timestamp_threshold: Optional[float] = None,
) -> Tuple[pd.DataFrame, pd.Series, pd.Series]:
    """
    Load parameters AND timestamps for each drawing from a TinyDB JSON dump.

    Also:
    - filters out drawings with score < score_min
    - filters out drawings whose metadata.agent_name != agent_name
    - normalizes timestamps to [0,1]

    Returns
    -------
    df_params : pandas.DataFrame
        Index = drawing IDs, Columns = parameter names (M, N1, ...)
    timestamps_norm : pandas.Series
        Index = drawing IDs, values = normalized timestamps in [0,1]
    urls : pandas.Series
        Index = drawing IDs, values = image URLs (or NaN if missing)
    """
    with open(json_path, "r", encoding="utf-8") as f:
        raw = json.load(f)

    table = raw.get("_default", raw)

    records: List[Dict[str, Any]] = []
    timestamp_records: List[Dict[str, Any]] = []
    url_records: List[Dict[str, Any]] = []

    for doc_id, doc in table.items():
        # Filter by score
        score = doc.get("score", 0)
        if score < score_min:
            continue

        # Filter by agent name
        metadata = doc.get("metadata", {})
        if metadata.get("agent_name") != agent_name:
            continue

        # Parameters (flatten)
        params = doc.get("parameters", {})
        flat_params = {name: meta.get("value") for name, meta in params.items()}

        # Timestamp (ms since epoch as string)
        ts = doc.get("timestamp")
        if ts is None:
            continue
        ts = float(ts)

        img_url = doc.get("url")

        records.append({"id": doc_id, **flat_params})
        timestamp_records.append({"id": doc_id, "timestamp": ts})
        url_records.append({"id": doc_id, "url": img_url})

    if not records:
        # No valid records
        empty_series_float = pd.Series(dtype=float)
        empty_series_obj = pd.Series(dtype=object)
        return pd.DataFrame(), empty_series_float, empty_series_obj

    df_params = pd.DataFrame(records).set_index("id")
    df_timestamp = pd.DataFrame(timestamp_records).set_index("id")
    df_urls = pd.DataFrame(url_records).set_index("id")

    ts = df_timestamp["timestamp"]
    urls = df_urls["url"]

    # Normalize timestamps to [0,1]
    timestamp_min, timestamp_max = ts.min(), ts.max()
    if timestamp_max > timestamp_min:
        normalized_timestamps = (ts - timestamp_min) / (timestamp_max - timestamp_min)
    else:
        # all timestamps identical -> all zero
        normalized_timestamps = ts * 0.0

    # filter by timestamp threshold
    if timestamp_threshold is not None:
        mask = normalized_timestamps >= timestamp_threshold
        df_params = df_params[mask]
        normalized_timestamps = normalized_timestamps[mask]
        urls = urls[mask]

    return df_params, normalized_timestamps, urls


def prepare_matrix(
    df_params: pd.DataFrame,
) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """
    Convert parameters df to numeric matrix, fill missing values, then standardize.

    Returns
    -------
    df_numeric : pd.DataFrame
        Numeric parameters with missing values filled (mean imputation).
    df_scaled : pd.DataFrame
        Standardized matrix (zero mean, unit variance) for clustering/TSNE.
    """
    # Convert to float and fill NaNs with column means
    df_numeric = df_params.astype(float).fillna(df_params.astype(float).mean())

    # Standardize features
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(df_numeric.values)

    df_scaled = pd.DataFrame(
        X_scaled, index=df_numeric.index, columns=df_numeric.columns
    )

    return df_numeric, df_scaled


# ---------------------------------------------------------------------------
# Clustering / dendrogram
# ---------------------------------------------------------------------------


def compute_dendrogram(
    df_scaled: pd.DataFrame,
    labels: List[Any],
    image_urls: Optional[pd.Series] = None,
) -> Dict[str, Any]:
    """
    Perform hierarchical clustering on standardized data
    and return dendrogram tree as JSON.

    Parameters
    ----------
    df_scaled : pd.DataFrame
        DataFrame with standardized parameters (rows = samples, columns = features).
    labels : list
        List of labels for each sample (e.g., drawing IDs).
    image_urls : pd.Series, optional
        Series mapping sample labels to image URLs.

    Returns
    -------
    tree_json : dict
        Nested dict representing the dendrogram tree.
    """
    Z = linkage(df_scaled.values, method="ward", metric="euclidean")

    url_mapping: Optional[Mapping[Any, str]] = None
    if image_urls is not None:
        url_mapping = image_urls.to_dict()

    root = linkage_to_node_tree(Z, labels=labels, image_urls=url_mapping)
    tree_json = node_to_json(root)
    return tree_json


def compute_tsne(df_scaled: pd.DataFrame) -> np.ndarray:
    """
    Compute t-SNE embedding of the standardized data.

    Parameters
    ----------
    df_scaled : pd.DataFrame
        DataFrame with standardized parameters (rows = samples, columns = features).

    Returns
    -------
    X_embedded : np.ndarray
        2D array of shape (n_samples, 2) with t-SNE coordinates.
    """

    n_samples = df_scaled.shape[0]
    # Safe perplexity choice: between 5 and 30, but < n_samples
    perplexity = min(30.0, max(5.0, float(n_samples - 1))) if n_samples > 1 else 5.0

    tsne = TSNE(n_components=2, perplexity=perplexity, random_state=42)
    X_embedded = tsne.fit_transform(df_scaled.values)
    return X_embedded


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def return_json_tree(
    json_path: Path,
    agent_name: str = "manual",
    score_min: float = 90,
    timestamp_threshold: float = 0.0,
) -> Dict[str, Any]:
    """
    Load data from TinyDB JSON file, optionally filter by timestamp,
    build a hierarchical clustering dendrogram on standardized data,
    and return it as JSON.

    Parameters
    ----------
    json_path : Path
        Path to tinydb.json file.
    timestamp_threshold : float
        Filter out drawings with normalized timestamp below this value.
    agent_name : str
        Only keep drawings whose metadata.agent_name matches this.

    Returns
    -------
    tree_json : dict
        Nested dict representing the dendrogram tree.
        Empty dict if no valid parameters are found.
    """
    df_params, timestamps_norm, urls = load_tinydb_data(
        json_path,
        agent_name=agent_name,
        score_min=score_min,
        timestamp_threshold=timestamp_threshold,
    )
    if df_params.empty:
        return {}

    _, df_scaled = prepare_matrix(df_params)

    ids = list(df_scaled.index)
    urls_filtered = urls.reindex(df_scaled.index)

    tree_json = compute_dendrogram(
        df_scaled=df_scaled,
        labels=ids,
        image_urls=urls_filtered,
    )

    return tree_json


def return_json_tsne(
    json_path: Path,
    agent_name: str = "manual",
    score_min: float = 90,
    timestamp_threshold: float = 0.0,
) -> Dict[str, Any]:
    """
    Load data from TinyDB JSON file, optionally filter by timestamp,
    compute t-SNE embedding on standardized data, and return it as JSON.

    Parameters
    ----------
    json_path : Path
        Path to tinydb.json file.
    timestamp_threshold : float
        Filter out drawings with normalized timestamp below this value.
    agent_name : str
        Only keep drawings whose metadata.agent_name matches this.

    Returns
    -------
    tsne_json : dict
        Dict with 'ids', 'coordinates', and 'urls' keys.
        Empty dict if no valid parameters are found.
    """
    df_params, timestamps_norm, urls = load_tinydb_data(
        json_path,
        agent_name=agent_name,
        score_min=score_min,
        timestamp_threshold=timestamp_threshold,
    )
    if df_params.empty:
        return {}

    _, df_scaled = prepare_matrix(df_params)

    ids = list(df_scaled.index)

    X_embedded = compute_tsne(df_scaled=df_scaled)

    urls_filtered = urls.reindex(df_scaled.index)

    urls_list = urls_filtered.where(pd.notnull(urls_filtered), None).tolist()

    tsne_json = {
        "ids": ids,
        "coordinates": X_embedded.tolist(),
        "urls": urls_list,
    }

    return tsne_json
