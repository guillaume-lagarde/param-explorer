import logging
from typing import Any, Dict, Optional, Tuple

from ..utils.sampler import sample_random_params

logger = logging.getLogger(__name__)

AGENT_NAME = "random"


class AgentRandom:
    def __init__(self, parameters_def: Dict[str, Dict[str, Any]]) -> None:
        logger.info("Initializing AgentRandom")
        self.parameters_def = parameters_def

    def play(self) -> Tuple[Dict[str, Any], Dict[str, Any]]:
        """
        Generate a random parameter set and associated metadata.
        """
        logger.info("AgentRandom: Generating random parameters")
        params = sample_random_params(self.parameters_def)
        metadata = {"agent_name": AGENT_NAME}
        return params, metadata

    def update(
        self,
        params: Dict[str, Any],
        score: float,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        """
        Random agent ignores updates.
        """
        logger.info("Update AgentRandom, no action taken.")

    def time_warp(self, time_increment: int) -> None:
        """
        Random agent is stateless; time_warp does nothing.
        """
        logger.info(
            f"AgentRandom: time_warp called with increment {time_increment}, no action taken."
        )
