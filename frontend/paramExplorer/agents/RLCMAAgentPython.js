class RLCMAAgentPython extends RLAgentPython
{
  // -------------------------------------------------
  constructor(param_explorer) 
  {
    super(param_explorer, "cma-es");
  }

  // -------------------------------------------------
  getDescription() 
  {
    return "RLCMAAgentPython (remote AgentRandom Python): delegates parameter generation to the server via /agent/play and /agent/update.";
  }
}
