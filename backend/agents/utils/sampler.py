# sampler.py
import logging
import math
import random
from typing import Any, Dict, Iterable, Mapping, Optional

import numpy as np

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Basic per-parameter sampling
# ---------------------------------------------------------------------------


def sample_parameter(name: str, param_def: Mapping[str, Any]) -> Any:
    """
    Sample a value for a single parameter based on its definition.

    Parameters
    ----------
    name : str
        Parameter name (used for warnings).
    param_def : Mapping[str, Any]
        Parameter definition. Expected keys:
        - "type": "float" | "integer" | "choice"
        - "range": (lo, hi) for numeric types
        - "choices": list of possible values for "choice" type

    Returns
    -------
    Any
        Sampled value, or None if the parameter type is unsupported or invalid.
    """
    ptype = param_def.get("type")

    if ptype == "float":
        lo, hi = param_def["range"]
        return float(np.random.uniform(lo, hi))

    if ptype == "integer":
        lo, hi = param_def["range"]
        return int(np.random.randint(lo, hi + 1))

    if ptype == "choice":
        choices = param_def["choices"]
        return random.choice(choices)

    logger.warning(
        f"Unsupported parameter type '{ptype}' for parameter '{name}'. Skipping."
    )
    return None


# ---------------------------------------------------------------------------
# Distances in normalized space
# ---------------------------------------------------------------------------


def squared_distance(
    p1: Mapping[str, float],
    p2: Mapping[str, float],
    keys: Optional[Iterable[str]] = None,
) -> float:
    """
    Squared Euclidean distance between two normalized-param dicts.

    Parameters
    ----------
    p1, p2 : Mapping[str, float]
        Dictionaries mapping parameter name -> normalized value.
    keys : Iterable[str], optional
        If provided, only these keys are used; otherwise use the
        intersection of p1 and p2 keys.

    Returns
    -------
    float
        Sum over k in keys of (p1[k] - p2[k])**2.
    """
    if keys is None:
        keys = set(p1.keys()) & set(p2.keys())

    s = 0.0
    for k in keys:
        v1 = p1[k]
        v2 = p2[k]
        s += (v1 - v2) ** 2
    return s


# ---------------------------------------------------------------------------
# Normalization / denormalization
# ---------------------------------------------------------------------------


def normalize_params(
    params: Mapping[str, Any],
    parameters_def: Mapping[str, Mapping[str, Any]],
) -> Dict[str, float]:
    """
    Map float/integer/choice parameters to [0,1] according to their definition.

    - float/integer: linear scaling from [lo, hi] -> [0,1]
    - choice: index / (n-1), or 0.0 if there is a single choice

    Parameters
    ----------
    params : Mapping[str, Any]
        Original parameter dict.
    parameters_def : Mapping[str, Mapping[str, Any]]
        Definitions for each parameter.

    Returns
    -------
    Dict[str, float]
        Normalized parameters.
    """
    norm_params = {}

    for name, param_def in parameters_def.items():
        if name not in params:
            continue

        ptype = param_def.get("type")

        if ptype in ("float", "integer"):
            lo, hi = param_def["range"]
            norm_params[name] = (params[name] - lo) / (hi - lo)

        elif ptype == "choice":
            choices = param_def.get("choices")

            n = len(choices)
            try:
                idx = choices.index(params[name])
            except ValueError:
                logger.warning(
                    f"Value '{params[name]}' for parameter '{name}' not found in choices. Skipping."
                )
                continue

            if n == 1:
                norm_params[name] = 0.0
            else:
                norm_params[name] = idx / (n - 1)

        else:
            logger.warning(
                f"Unsupported parameter type '{ptype}' for parameter '{name}'. "
                f"Skipping normalization."
            )

    return norm_params


def denormalize_params(
    norm_params: Mapping[str, float],
    parameters_def: Mapping[str, Mapping[str, Any]],
) -> Dict[str, Any]:
    """
    Inverse of `normalize_params`: map normalized [0,1] back to the original space.

    - float: linear scaling [0,1] -> [lo, hi]
    - integer: linear + rounding + clipping to [lo, hi]
    - choice: map index from [0, 1] * (n-1) to the nearest integer index

    Parameters
    ----------
    norm_params : Mapping[str, float]
        Normalized parameters.
    parameters_def : Mapping[str, Mapping[str, Any]]
        Definitions for each parameter.

    Returns
    -------
    Dict[str, Any]
        Parameters in original space.
    """
    params: Dict[str, Any] = {}

    for name, param_def in parameters_def.items():
        if name not in norm_params:
            continue

        ptype = param_def.get("type")
        norm_val = norm_params[name]

        if ptype == "float":
            lo, hi = param_def["range"]
            params[name] = norm_val * (hi - lo) + lo

        elif ptype == "integer":
            lo, hi = param_def["range"]
            val = norm_val * (hi - lo) + lo
            x = round(val)
            params[name] = int(np.clip(x, lo, hi))

        elif ptype == "choice":
            choices = param_def.get("choices")
            n = len(choices)

            if n == 1:
                params[name] = choices[0]
            else:
                idx = int(round(norm_val * (n - 1)))
                idx = int(np.clip(idx, 0, n - 1))
                params[name] = choices[idx]

        else:
            logger.warning(
                f"Unsupported parameter type '{ptype}' for parameter '{name}'. "
                f"Skipping denormalization."
            )

    return params


# ---------------------------------------------------------------------------
# High-level sampling
# ---------------------------------------------------------------------------


def sample_random_params(
    parameters_def: Mapping[str, Mapping[str, Any]],
    repulsive_points: Optional[Iterable[Mapping[str, Any]]] = None,
    max_tries: int = 1000,
) -> Dict[str, Any]:
    """
    Sample a full parameter dictionary.

    If `repulsive_points` is None or empty:
        - Sample uniformly at random from each parameter definition.

    If `repulsive_points` is provided:
        - Normalize all repulsive points.
        - Draw `max_tries` random candidates uniformly.
        - Return the candidate whose minimum squared distance to all
          repulsive points (in normalized space) is largest
          => farthest-point heuristic.

    Parameters
    ----------
    parameters_def : Mapping[str, Mapping[str, Any]]
        Parameter definitions.
    repulsive_points : iterable of dict, optional
        Points in original parameter space to repel from.
    max_tries : int, default 1000
        Number of random candidates to sample; the farthest is returned.

    Returns
    -------
    Dict[str, Any]
        Sampled parameter dictionary.
    """
    # Simple uniform sampling if no repulsive points
    if not repulsive_points:
        logger.debug("Sampling parameters without repulsive points.")
        params = {}
        for name, param_def in parameters_def.items():
            value = sample_parameter(name, param_def)
            if value is not None:
                params[name] = value
        return params

    # Precompute normalized versions of the repulsive points
    repulsive_norm = [normalize_params(rp, parameters_def) for rp in repulsive_points]

    # Keys to use for distance: all numeric/choice parameters
    all_keys = {
        name
        for name, param_def in parameters_def.items()
        if param_def.get("type") in ("float", "integer", "choice")
    }

    best_candidate = None
    best_min_sqdist = -1.0

    for _ in range(max_tries):
        # Step 1: sample uniformly
        candidate = {}
        for name, param_def in parameters_def.items():
            value = sample_parameter(name, param_def)
            if value is not None:
                candidate[name] = value

        # Step 2: normalize candidate
        candidate_norm = normalize_params(candidate, parameters_def)

        # Step 3: compute distance to nearest repulsive point
        min_sqdist = math.inf
        for rp_norm in repulsive_norm:
            d2 = squared_distance(candidate_norm, rp_norm, keys=all_keys)
            if d2 < min_sqdist:
                min_sqdist = d2

        # Step 4: keep track of farthest candidate
        if min_sqdist > best_min_sqdist:
            best_min_sqdist = min_sqdist
            best_candidate = candidate

    logger.debug(
        f"sample_random_params: best min squared distance to repulsive points: {best_min_sqdist}"
    )

    return best_candidate


def sample_gaussian_around(
    base_params: Mapping[str, Any],
    sigma: Any,
    parameters_def: Mapping[str, Mapping[str, Any]],
    clip: bool = True,
) -> Dict[str, Any]:
    """
    Sample a new parameter dict from a Gaussian centered at `base_params`
    in normalized space.

    - The parameters are first normalized to [0,1].
    - For types "float", "integer", and "choice", we sample:

        norm[name] ~ Normal(norm_base[name], sigma_param)

      where `sigma_param` is:
        - `sigma[name]` if `sigma` is a dict
        - `sigma` (scalar) otherwise

    - If `clip` is True, we clip normalized values to [0,1].

    Parameters
    ----------
    base_params : Mapping[str, Any]
        Base point in original space.
    sigma : float or Mapping[str, float]
        Standard deviation in normalized space (scalar or per-parameter dict).
    parameters_def : Mapping[str, Mapping[str, Any]]
        Parameter definitions.
    clip : bool, default True
        Whether to clip normalized values to [0,1].

    Returns
    -------
    Dict[str, Any]
        Sampled parameter dict in original space.
    """
    norm_base = normalize_params(base_params, parameters_def)
    norm_sampled = {}

    for name, base_val in norm_base.items():
        ptype = parameters_def[name].get("type")

        if ptype in ("float", "integer", "choice"):
            # Support scalar sigma or per-parameter sigma dict
            if isinstance(sigma, dict):
                s = sigma.get(name, 1.0)
            else:
                s = sigma

            val = float(np.random.normal(base_val, s))
            if clip:
                val = float(np.clip(val, 0.0, 1.0))
            norm_sampled[name] = val

        else:
            # Unsupported or unnormalized types: keep the normalized value as is
            norm_sampled[name] = base_val

    return denormalize_params(norm_sampled, parameters_def)
