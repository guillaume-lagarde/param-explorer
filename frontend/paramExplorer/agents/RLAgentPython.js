class RLAgentPython extends RLAgent
{
    static __LOG__ = true;

    // -------------------------------------------------
    constructor(param_explorer, name='RLAgentPython')
    {
        super(param_explorer);
        this.name = name;
    }


    // -------------------------------------------------
    async play(opts = {}) 
    {
        if (RLAgentPython.__LOG__)
            console.group("RLAgentPython.play() [remote Agent]");

        if (!this.param_explorer) {
            if (RLAgentPython.__LOG__)
            console.groupEnd();
            return;
        }

        const payload = {
            session_id: this.param_explorer.session_id,
            agent_name: this.name, 
            parameters_def: this.param_explorer.getParametersDef(), // parameter definitions
        };

        console.log("Envoi au serveur /agent/play :", payload);

        let result;
        try {
            result = await call('agent/play', payload);
        } catch (err) {
            console.error("Error calling /agent/play:", err);
            return;
        }

        if (!result || result.status !== "ok" || !result.parameters) {
            console.warn("/agent/play returned an unexpected format:", result);
            return;
        }


        // Apply received parameters
        const paramsDef = this.param_explorer.parameters || {};
        let parameters = {}
        for (const [name, raw] of Object.entries(result.parameters)) 
        {
            const def = paramsDef[name];

            // No def or freeze
            if (!def) continue;
            if (def.freeze) continue;

            // Validate value
            let v = Number(raw);
            if (!Number.isFinite(v)) continue;

            parameters[name] = v;

            if (RLAgentPython.__LOG__)
            console.log("val pour", name, ":", v);
        }

        if (RLAgentPython.__LOG__)
            console.groupEnd();

        return {
            'parameters'  : parameters,
            'metadata'    : result.metadata
        };
    }

  // -------------------------------------------------
  // UPDATE: sends (params, score) to the server for the Python agent to learn
  async update(results) {

    if (Array.isArray(results)) {
      for (const r of results) {
        await this._updateOne(r);
      }
      return;
    }
    await this._updateOne(results);
  }

  // -------------------------------------------------
  async _updateOne(r) {
    if (!r) return;

    const score = Number(r.score);
    if (!Number.isFinite(score)) return;

    const payload = 
    {
      session_id:       this.param_explorer.session_id,
      agent_name:       this.name,
      parameters_def:   this.param_explorer.getParametersDef(),
      parameters:       this._extractFlatFromResult(r),
      metadata:         r.metadata || {},
      score:            score
    };

    try {
      await call('agent/update', payload);
    } catch (err) {
      console.error("Error calling /agent/update:", err);
    }
  }

 // -------------------------------------------------
  // TIME_WARP: delegates to the Python agent via /agent/time_warp
  async timeWarp(steps = 1) {

    const nSteps = Number(steps);
    if (!Number.isFinite(nSteps)) {
      console.warn("timeWarp: steps must be a number, received:", steps);
      return;
    }

    const payload = {
      session_id: this.param_explorer.session_id,
      agent_name: this.name,
      parameters_def: this.param_explorer.getParametersDef(),
      n_steps: nSteps,
    };

    try {
      const result = await call('agent/time_warp', payload);
      if (!result || result.status !== "ok") {
        console.warn("/agent/time_warp returned an unexpected format:", result);
      }
    } catch (err) {
      console.error("Error calling /agent/time_warp:", err);
    }
  }


  // -------------------------------------------------
  // Builds a "clean" dictionary of parameter definitions
  // from param_explorer.parameters, inspired by RLRandomAgentTest._initFromParamExplorer
  // TODO: no need to make a copy, we can do it cleaner.
  _initializeParametersDefinitions() {
    const defs = {};

    if (!this.param_explorer || !this.param_explorer.parameters) {
      console.warn("RLAgentPython._initializeParametersDefinitions: param_explorer.parameters missing");
      return defs;
    }

    for (const [name, param] of Object.entries(this.param_explorer.parameters)) {
      if (!param || typeof param !== "object") continue;

      const type = param.type || "float";
      const range = param.range || [0, 1];
      const min = range[0] ?? 0;
      const max = range[1] ?? 1;
      const step = param.step || 0;
      const choices = param.choices || null;
      const freeze = !!param.freeze;

      // Only put what is serializable on the Python side in defs
      defs[name] = {
        type,
        min,
        max,
        step,
        choices,
        freeze,
      };
    }

    return defs;
  }

  // -------------------------------------------------
  // In case the agent was built before param_explorer.parameters was filled
  /*_ensureParametersDef  () {
    if (!this.parameters_def || Object.keys(this.parameters_def).length === 0) {
      this.parameters_def = this._initializeParametersDefinitions();
      console.log("RLAgentPython: parameters_def (lazy) =", this.parameters_def);
    }
  }*/

  // -------------------------------------------------
  // Extract a dict { name: number } from a result (imagesInfos, etc.)
  _extractFlatFromResult(r) {
    const flat = {};
    if (!r) return flat;

    if (r.parameters && typeof r.parameters === 'object') {
      // load_data case: parameters: { name: {type, freeze, value}, ... }
      for (const [name, p] of Object.entries(r.parameters)) {
        if (p && typeof p === 'object' && 'value' in p) {
          const v = Number(p.value);
          if (Number.isFinite(v)) flat[name] = v;
        } else if (typeof p === 'number') {
          const v = Number(p);
          if (Number.isFinite(v)) flat[name] = v;
        }
      }
    }
    /*
    else if (Array.isArray(r) && r.length >= 2) {
      // case [paramsObj, score]
      const pObj = r[0] || {};
      for (const [name, vRaw] of Object.entries(pObj)) {
        const v = Number(vRaw);
        if (Number.isFinite(v)) flat[name] = v;
      }
    }
      */

    return flat;
  }
}