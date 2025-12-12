class RLOpenEndedAgentPython extends RLAgentPython
{
  // -------------------------------------------------
  constructor(param_explorer) 
  {
    super(param_explorer, "open-ended");
  }

  // -------------------------------------------------
  getDescription() 
  {
    return "RLOpenEndedPython (remote AgentOpenEnded Python): delegates parameter generation to the server via /agent/play and /agent/update.";
  }
}
