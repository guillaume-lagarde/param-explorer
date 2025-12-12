class RLAgent 
{

  constructor(param_explorer) 
  {
    this.param_explorer = param_explorer;
  }

  // 
  async play(opts={})
  {
    return {
      'parameters'  : [],
      'metadata'    : []
    }
  }
  async update    (results)    {}
  async timeWarp  (steps = 1)  {}  
  getDescription  (){
    return "RLAgent interface description"
  }
}

