import logging
import random
from typing import Any, Dict, List, Optional, Tuple

from ..utils.sampler import (
    sample_random_params,
    sample_gaussian_around,
)

logger = logging.getLogger(__name__)

AGENT_NAME = "open-ended"
AGENT_MANUAL = "manual"


class AgentOpenEnded:
    """
    Evolutionary-style agent that alternates between:
    - exploration: sampling random parameters with repulsion from past bad ones
    - exploitation: sampling around existing successful parameter sets

    Populations:
    - pop_idx = 0 is reserved for exploration.
    - pop_idx >= 1 are exploitation populations centered on previously good params.
    """

    def __init__(self, parameters_def: Dict[str, Dict[str, Any]]) -> None:
        logger.info("Initializing AgentInfinite")
        # { name: { "type": ..., "min": ..., "max": ... } }
        self.parameters_def = parameters_def

        self.population_size: int = 1
        self.max_population_size: int = None

        # History of (params, score) per population index
        self.history = {pop_idx: [] for pop_idx in range(self.population_size)}
        self.max_history_length: int = 10
        self.restart_population_size: int = 4

        # Note: pop_idx 0's sigma is not used (only random sampling).
        self.sigmas = {pop_idx: 1.0 for pop_idx in range(self.population_size)}
        self.initial_sigma_when_new_population: float = 0.25
        self.sigma_decay: float = 0.9
        self.sigma_min: float = 0.001

        self.min_exploration_probability: float = 1.0 / 4.0

        self.repulsive_points = []

        self.time: int = 0

    def _reduce_history_size(self, pop_idx: int) -> None:
        """
        Reduce the history size for the given population index by random
        subsampling if it exceeds max_history_length.
        """
        current_history = self.history[pop_idx]
        if len(current_history) <= self.max_history_length:
            return

        logger.info(
            f"Reducing history size for pop_idx {pop_idx}: {len(current_history)} -> {self.restart_population_size}"
        )

        target_size = min(self.restart_population_size, len(current_history))
        self.history[pop_idx] = random.sample(current_history, target_size)

    def _select_population_idx(self) -> int:
        """
        Select which population index to use:

        - With probability max(min_exploration_probability, 1/population_size),
          choose pop_idx = 0 (exploration).
        - Otherwise, choose among pop_idx >= 1 with probability proportional
          to their sigma values to force exploration of less-explored populations.
        """
        random_float = random.random()
        exploration_probability = max(
            self.min_exploration_probability,
            1.0 / self.population_size,
        )

        if random_float < exploration_probability or self.population_size == 1:
            logger.info("Population selection: exploration (pop_idx=0)")
            return 0

        pop_indices = list(self.sigmas.keys())[1:]
        weights = [self.sigmas[i] for i in pop_indices]

        chosen = random.choices(population=pop_indices, weights=weights, k=1)[0]
        logger.info(f"Population selection: exploitation (pop_idx={chosen})")
        return chosen

    def play(self) -> Tuple[Dict[str, Any], Dict[str, Any]]:
        """
        Generate a new parameter set and associated metadata.

        Returns:
            params: sampled parameters.
            metadata: information about which agent/population generated them.
        """
        logger.info("AgentInfinite: Generating parameters")
        pop_idx = self._select_population_idx()

        if pop_idx == 0:
            # Pure exploration with repulsive sampling
            params = sample_random_params(
                self.parameters_def,
                repulsive_points=self.repulsive_points,
            )
        else:
            # Exploitation: sample around a historical point from pop_idx
            base_params, _ = random.choice(self.history[pop_idx])
            params = sample_gaussian_around(
                base_params,
                sigma=self.sigmas[pop_idx],
                parameters_def=self.parameters_def,
            )

        metadata = {"agent_name": AGENT_NAME, "pop_idx": pop_idx}
        logger.info(f"AgentInfinite: Generated parameters with pop_idx {pop_idx}")
        return params, metadata

    def update(
        self,
        params: Dict[str, Any],
        score: float,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        """
        Update internal state with the result of playing a given parameter set.

        Args:
            params: parameters that were evaluated.
            score: score.
            metadata: if None, the update is skipped.
        """
        logger.info("AgentInfinite: update called")

        if metadata is None:
            logger.warning(
                "AgentInfinite.update called with metadata=None, skipping update"
            )
            return

        agent_name = metadata.get("agent_name", "")
        if agent_name not in {AGENT_NAME, AGENT_MANUAL}:
            logger.info(
                f"AgentInfinite.update: agent_name '{agent_name}' not in {{{AGENT_NAME}, {AGENT_MANUAL}}}, skipping update"
            )
            return

        logger.info(f"metadata: {metadata}")

        if score == 0:
            logger.info("Adding params to repulsive points due to zero score")
            self.repulsive_points.append(params)
            return

        if agent_name == AGENT_NAME:
            pop_idx = metadata.get("pop_idx")
        else:
            # Manual agent gets its own new population index
            pop_idx = self.population_size

        if pop_idx == 0 or agent_name == AGENT_MANUAL:
            # Create a new population
            pop_idx = self.population_size
            self.population_size += 1

            self.history[pop_idx] = [(params, score)]
            self.sigmas[pop_idx] = self.initial_sigma_when_new_population
            logger.info(
                f"Created new population pop_idx={pop_idx} with initial sigma={self.initial_sigma_when_new_population}"
            )
        else:
            # Update existing population
            self.history[pop_idx].append((params, score))
            old_sigma = self.sigmas[pop_idx]
            new_sigma = max(self.sigma_min, old_sigma * self.sigma_decay)
            self.sigmas[pop_idx] = new_sigma
            logger.info(
                f"Updated population pop_idx={pop_idx}: sigma {old_sigma} -> {new_sigma}"
            )

        self.repulsive_points.append(params)

        self._reduce_history_size(pop_idx)

        self.time += 1
        logger.info(f"AgentInfinite: Updated history for pop_idx {pop_idx}")
        logger.info(f"Current sigmas: {self.sigmas}")

    def time_warp(self, time_increment: int) -> None:
        """
        Advance internal time by `time_increment` steps and decay sigmas as if
        that many updates had happened.
        """
        logger.info("AgentInfinite: time_warp called with increment %s", time_increment)
        decay_factor = self.sigma_decay**time_increment

        self.sigmas = {
            pop_idx: max(self.sigma_min, sigma * decay_factor)
            for pop_idx, sigma in self.sigmas.items()
        }
        logger.info("AgentInfinite: sigmas after time_warp: %s", self.sigmas)
