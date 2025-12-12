import logging
import random
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from sklearn.cluster import KMeans

from ..utils.sampler import (
    sample_random_params,
    sample_gaussian_around,
    normalize_params,
)

logger = logging.getLogger(__name__)

AGENT_NAME = "gaussian"
AGENT_MANUAL = "manual"


class AgentGaussian:
    def __init__(self, parameters_def: Dict[str, Dict[str, Any]]) -> None:
        logger.info("Initializing AgentGaussian")
        # { name: { "type": ..., "min": ..., "max": ... } }
        self.parameters_def = parameters_def

        # history: list of (params, score, pop_idx)
        self.history = []
        self.population_size = 2
        self.max_history_length = 4 * self.population_size

        # per-population sigmas in normalized space
        self.sigmas = {pop_idx: 1.0 for pop_idx in range(self.population_size)}
        self.sigma_decay = 0.9
        self.sigma_min = 0.001

        # Only float parameters used for clustering
        self.parameters_for_clustering = [
            name
            for name, pdef in parameters_def.items()
            if pdef.get("type") in ("float", "integer")
        ]

        self.time = 0

    # --------------------------------------------------------------------- #
    # Internals
    # --------------------------------------------------------------------- #

    def _reduction_history_size(self) -> None:
        """
        Cluster history into `population_size` clusters and keep one
        representative per cluster, updating history and sigmas.
        """
        logger.info("Performing clustering to reduce history size")

        if len(self.history) <= self.population_size:
            return

        # Build data matrix in normalized space
        data = []
        for params, score, pop_idx in self.history:
            norm_p = normalize_params(params, self.parameters_def)
            row = [norm_p[name] for name in self.parameters_for_clustering]
            data.append(row)

        data = np.array(data)

        # Cluster into population_size clusters
        kmeans = KMeans(n_clusters=self.population_size, random_state=0).fit(data)

        # Collect points per cluster
        best_points = {i: [] for i in range(self.population_size)}
        for idx, label in enumerate(kmeans.labels_):
            params, score, pop_idx = self.history[idx]
            best_points[label].append((params, score, pop_idx))

        old_sigmas = self.sigmas.copy()
        new_history = []
        new_sigmas = {}

        # Shuffle new population indices to avoid bias
        available_new_pop_idxs = list(range(self.population_size))
        random.shuffle(available_new_pop_idxs)

        for cluster_idx in range(self.population_size):
            points = best_points[cluster_idx]

            params_i, score_i, old_pop_idx_i = agglomerate_best_points(points)

            if old_pop_idx_i in available_new_pop_idxs:
                new_pop_idx = old_pop_idx_i
                available_new_pop_idxs.remove(old_pop_idx_i)
            else:
                new_pop_idx = available_new_pop_idxs.pop()

            sigma = old_sigmas[old_pop_idx_i]

            # If the cluster is too small, increase sigma for exploration
            if len(points) <= 1:
                if sigma < 0.1:
                    sigma = 0.1
                elif sigma < 0.2:
                    sigma = 0.2
                elif sigma < 0.5:
                    sigma = 0.5
                else:
                    sigma = 1.0

            new_history.append((params_i, score_i, new_pop_idx))
            new_sigmas[new_pop_idx] = sigma

        self.history = new_history
        self.sigmas = new_sigmas

    def _closest_agent_idx(self, params: Dict[str, Any]) -> Optional[int]:
        """
        Find the closest existing population index (in normalized space)
        to the given params. Returns None if no history.
        """
        if not self.history:
            return None

        norm_params = normalize_params(params, self.parameters_def)

        distance = float("inf")
        closest_idx = None

        for base_params, _, pop_idx in self.history:
            norm_base_params = normalize_params(base_params, self.parameters_def)

            dist = 0.0
            for name in self.parameters_for_clustering:
                p1 = norm_params[name]
                p2 = norm_base_params[name]
                dist += (p1 - p2) ** 2
            dist = float(np.sqrt(dist))

            if dist < distance:
                distance = dist
                closest_idx = pop_idx

        return closest_idx

    # ------------------------------------------------------------------------- #
    def play(self) -> Tuple[Dict[str, Any], Dict[str, Any]]:
        """
        Generate a new parameter set and associated metadata.
        """
        logger.info("AgentGaussian: Generating parameters")

        if len(self.history) < self.population_size:
            # Warm-up: sample uniformly at random
            pop_idx = len(self.history)
            params = sample_random_params(self.parameters_def)
        else:
            # Exploration: sample around a previously good point
            base_params, _, pop_idx = random.choice(self.history)
            params = sample_gaussian_around(
                base_params,
                sigma=self.sigmas[pop_idx],
                parameters_def=self.parameters_def,
            )

        metadata = {"agent_name": AGENT_NAME, "pop_idx": pop_idx}
        logger.info(f"AgentGaussian: Generated parameters with pop_idx {pop_idx}")
        return params, metadata

    def update(
        self,
        params: Dict[str, Any],
        score: float,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        """
        Update internal state with the result of playing a given parameter set.
        """
        logger.info("Update AgentGaussian")

        if metadata is None:
            logger.warning("AgentGaussian.update called with metadata=None, skipping")
            return

        agent_name = metadata["agent_name"]
        if agent_name not in [AGENT_NAME, AGENT_MANUAL]:
            logger.info(
                f"{agent_name} != {AGENT_NAME} or {AGENT_MANUAL}, skipping update"
            )
            return

        logger.info(f"metadata: {metadata}")

        if agent_name == AGENT_NAME:
            pop_idx = metadata["pop_idx"]
        else:
            # If unknown, attach to closest agent or random
            closest_idx = self._closest_agent_idx(params)
            if closest_idx is not None:
                pop_idx = closest_idx
                logger.info(f"Unknown params, assigned to closest pop_idx #{pop_idx}")
            else:
                pop_idx = int(np.random.randint(self.population_size))
                logger.info(f"Unknown params, assigned randomly to pop_idx #{pop_idx}")

        self.history.append((params, score, pop_idx))
        self.sigmas[pop_idx] = max(
            self.sigma_min, self.sigmas[pop_idx] * self.sigma_decay
        )

        if len(self.history) > self.max_history_length:
            self._reduction_history_size()

        self.time += 1
        logger.info(f"AgentGaussian time step: {self.time}")

    def time_warp(self, time_increment: int) -> None:
        """
        Advance internal time by `time_increment` steps and decay sigmas as if
        that many updates had happened.
        """
        logger.info(f"AgentGaussian: time_warp called with increment {time_increment}")
        decay_factor = self.sigma_decay**time_increment
        self.sigmas = {
            pop_idx: max(self.sigma_min, sigma * decay_factor)
            for pop_idx, sigma in self.sigmas.items()
        }
        logger.info(f"AgentGaussian: sigmas after time_warp: {self.sigmas}")


def agglomerate_best_points(
    points: List[Tuple[Dict[str, Any], float, int]],
) -> Tuple[Dict[str, Any], float, int]:
    """
    Aggregate a list of (params, score, pop_idx) into a single representative.
    Currently: pick a random point from the list.
    """
    return random.choice(points)
