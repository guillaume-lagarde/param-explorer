import logging
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

from .cma_agent import CMAAgent

logger = logging.getLogger(__name__)

SCORE_SCALE = 100
AGENT_NAME = "cma-es"
AGENT_MANUAL = "manual"


class AgentCMAES:
    """
    Multi-CMA-ES agent built from our own CMAAgent:
    - maintains several CMAAgent optimizers (n_agents)
    - each play() picks one agent and samples from it
    - update() takes (params, score) and forwards to the correct CMAAgent based on
      pop_idx in metadata (or closest mean if unknown)
    - if two agents get too close in parameter space, we restart one
    """

    def __init__(
        self,
        parameters_def: Dict[str, Dict[str, Any]],
        sigma_frac: float = 0.2,
        population_size: Optional[int] = None,
        n_agents: int = 2,
        restart_min_dist: float = 0.15,
    ) -> None:
        """
        parameters_def: dict { name: { "type": "float"/"integer"/"choice", "range": [min, max], ... } }
        sigma_frac: initial sigma in normalized space (0–1) for CMAAgent
        population_size: hint passed to CMAAgent (not strict)
        n_agents: number of CMA sub-populations
        restart_min_dist: min distance (in normalized space) between agent means;
                          if closer, the later agent is restarted.
        """
        logger.info(
            f"Initializing AgentCMAES with parameter definitions: {parameters_def}"
        )

        self.parameters_def = parameters_def or {}

        # info needed for encoding / distance
        self._opt_names = []
        self._types = []
        self._mins = []
        self._maxs = []
        self._choices = {}  # name -> list of choices (for choice params)

        for name, p in self.parameters_def.items():
            if not isinstance(p, dict):
                continue

            ptype = p.get("type", "float")
            if ptype not in ("float", "integer", "choice"):
                logger.warning(
                    f"[AgentCMAES] Unsupported type '{ptype}' for '{name}', skipped."
                )
                continue

            if ptype == "choice":
                choices = p.get("choices", [])
                if not choices:
                    logger.warning(
                        f"[AgentCMAES] Choice param '{name}' has no 'choices', skipped."
                    )
                    continue
                lo, hi = 0.0, float(len(choices) - 1)
                self._choices[name] = choices
            else:  # float / integer
                lo, hi = p["range"]
                lo = float(lo)
                hi = float(hi)

                if lo >= hi:
                    logger.warning(
                        f"[AgentCMAES] Invalid range for '{name}' (min >= max), skipped."
                    )
                    continue

            self._opt_names.append(name)
            self._types.append(ptype)
            self._mins.append(lo)
            self._maxs.append(hi)

        if not self._opt_names:
            raise ValueError(
                "AgentCMAES: no optimizable parameters found in parameters_def"
            )

        self._mins = np.array(self._mins, dtype=float)
        self._maxs = np.array(self._maxs, dtype=float)
        self._dim = len(self._opt_names)

        # sigma in normalized space [0,1]^d
        self._sigma0 = float(sigma_frac)
        if self._sigma0 <= 0:
            self._sigma0 = 0.3

        # just pass through to CMAAgent
        self._pop_size_hint = int(population_size) if population_size is not None else 10

        # Multi-agent CMA: list of CMAAgent
        self.n_agents = int(n_agents)
        self._agents = []
        self._time = 0
        self._restart_min_dist = float(restart_min_dist)

        for i in range(self.n_agents):
            agent = CMAAgent(
                self.parameters_def,
                sigma0=self._sigma0,
                population_size=self._pop_size_hint,
            )
            # give each agent a random initial mean (in normalized space)
            agent.mean = np.random.rand(agent.dim)
            self._agents.append(agent)
            logger.info(
                f"[AgentCMAES] Initialized CMAAgent #{i} with random mean in [0,1]^d"
            )

    # ----------------------------------------------------------------------
    # Helpers
    # ----------------------------------------------------------------------

    def _encode_to_normalized(self, params: Dict[str, Any]) -> np.ndarray:
        """
        Encode a param dict into normalized vector in [0,1]^d.
        """
        x = np.zeros(self._dim, dtype=float)
        for i, name in enumerate(self._opt_names):
            ptype = self._types[i]
            lo = self._mins[i]
            hi = self._maxs[i]

            if ptype in ("float", "integer"):
                val = params.get(name, lo)
                if hi == lo:
                    x[i] = 0.0
                else:
                    x[i] = (float(val) - lo) / (hi - lo)
            elif ptype == "choice":
                choices = self._choices[name]
                n = len(choices)
                val = params.get(name, choices[0])
                try:
                    idx = choices.index(val)
                except ValueError:
                    idx = 0
                if n == 1:
                    x[i] = 0.0
                else:
                    x[i] = idx / float(n - 1)
            else:
                # Should not happen
                logger.warning(
                    f"[AgentCMAES] _encode_to_normalized: unsupported type '{ptype}' for '{name}', using 0.0"
                )
                x[i] = 0.0

        return np.clip(x, 0.0, 1.0)

    def _closest_pop_idx(self, params: Dict[str, Any]) -> Optional[int]:
        """
        Find the index of the agent whose mean is closest (in normalized space)
        to the encoded params. Returns None if no usable agent.
        """
        if not self._agents:
            return None

        x = self._encode_to_normalized(params)
        best_idx = None
        best_dist = float("inf")

        for idx, agent in enumerate(self._agents):
            if agent.mean is None:
                continue
            dist = float(np.linalg.norm(x - agent.mean))
            if dist < best_dist:
                best_dist = dist
                best_idx = idx

        return best_idx

    def _restart_agent(self, idx: int) -> None:
        """
        Restart the specified CMAAgent with a fresh random mean.
        """
        ag = CMAAgent(
            self.parameters_def,
            sigma0=self._sigma0,
            population_size=self._pop_size_hint,
        )
        ag.mean = np.random.rand(ag.dim)
        self._agents[idx] = ag
        logger.info(f"[AgentCMAES] Restarted CMAAgent #{idx} with new random mean")

    def _maybe_restart_similar_agents(self) -> None:
        """
        Greedy restart: go through agents in order, and if agent i is too close
        to any previous agent j (< i) in normalized space, restart agent i.
        """
        means = [agent.mean for agent in self._agents]

        for i in range(self.n_agents):
            mean_i = means[i]
            if mean_i is None:
                continue
            for j in range(i):
                mean_j = means[j]
                if mean_j is None:
                    continue
                dist = float(np.linalg.norm(mean_i - mean_j))
                if dist < self._restart_min_dist:
                    logger.info(
                        f"[AgentCMAES] Agents #{i} and #{j} too close "
                        f"(dist={dist:.4f}) -> restart #{i}"
                    )
                    self._restart_agent(i)
                    break  # move to next i after restarting


    def play(self) -> Tuple[Dict[str, Any], Dict[str, Any]]:
        """
        Choose one CMAAgent and propose ONE parameter set.
        """
        logger.info("AgentCMAES: Playing")
        if not self._agents:
            raise RuntimeError("AgentCMAES: optimizers not initialized")

        pop_idx = int(np.random.randint(self.n_agents))

        logger.info(f"AgentCMAES: Using agent #{pop_idx} to sample parameters")
        agent = self._agents[pop_idx]
        params = agent.play()

        metadata = {"agent_name": AGENT_NAME, "pop_idx": pop_idx}
        return params, metadata

    def update(
        self,
        params: Dict[str, Any],
        score: float,
        metadata: Dict[str, Any],
    ) -> None:
        """
        Update the appropriate CMAAgent with a new (params, score) sample.
        """
        agent_name = metadata["agent_name"]
        logger.info(
            f"### AgentCMAES: Updating"
        )

        if agent_name not in [AGENT_NAME, AGENT_MANUAL]:
            logger.info(
                f"{agent_name} != {AGENT_NAME} or {AGENT_MANUAL}, skipping update"
            )
            return

        logger.info(f"AgentCMAES metadata: {metadata}")
        self._time += 1

        normalized_score = float(score) / float(SCORE_SCALE)

        if agent_name == AGENT_NAME:
            pop_idx = int(metadata["pop_idx"])
        else:
            # manual agent: find closest CMAAgent
            closest_idx = self._closest_pop_idx(params)
            if closest_idx is not None:
                pop_idx = closest_idx
                logger.info(
                    f"AgentCMAES: unknown pop_idx, using closest pop_idx = {pop_idx}"
                )
            else:
                # fallback to a random agent
                pop_idx = int(np.random.randint(self.n_agents))
                logger.info(
                    f"AgentCMAES: unknown pop_idx, using random agent #{pop_idx}"
                )

        self._agents[pop_idx].update(params, normalized_score, metadata)

        self._maybe_restart_similar_agents()

    def time_warp(self, time_increment: int) -> None:
        """
        Simulate a time warp by adjusting the internal state of all CMAAgents.

        time_increment: positive integer indicating how much time has passed.
        """
        logger.info(
            f"AgentCMAES: Time warped by {time_increment}, updating all agents."
        )
        self._time += time_increment
        for idx, agent in enumerate(self._agents):
            logger.info(f"AgentCMAES: time_warp for agent #{idx}")
            agent.time_warp(time_increment)
