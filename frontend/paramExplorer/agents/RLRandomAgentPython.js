class RLRandomAgentPython extends RLAgentPython
{

  // -------------------------------------------------
  constructor(param_explorer) 
  {
    super(param_explorer, "random");
  }

  // -------------------------------------------------
  getDescription() {
    return "RLRandomAgentPython (remote AgentRandom Python): delegates parameter generation to the server via /agent/play and /agent/update.";
  }
}
