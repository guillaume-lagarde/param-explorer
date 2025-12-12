class RLGaussianAgentPython extends RLAgentPython
{

  // -------------------------------------------------
  constructor(param_explorer) 
  {
    super(param_explorer, "gaussian");
  }

  // -------------------------------------------------
  getDescription() {
    return "RLGaussianAgentPython (remote AgentRandom Python): delegates parameter generation to the server via /agent/play and /agent/update.";
  }
}
