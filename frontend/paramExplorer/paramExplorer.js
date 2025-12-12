class ParamExplorer
{
    static __LOG__          = true;
    static BATCH_SIZE_MAX   = 10;
    static PARAMETERS_TYPE  = ['float', 'integer', 'choice'];

    constructor(id,opts={})
    {
        this.id         = `paramexplorer-${id}`;
        this.session_id = getSessionId(id);
        this.batch_size = opts.batch_size??1;
        this.parameters = {};
        this.reset();
        if (ParamExplorer.__LOG__)
            console.log(`ParamExplorer constructor, session id=${this.session_id}`);
    }

    reset()
    {
        this.batch_index        = 0;
        this.batch_parameters   = [];
        this.batch_metadata     = [];
        this.batch_running      = false; 
        return this;
    }

    setParameters(parameters)
    {
        this.parameters = {};
        for (let name in parameters)
        {
            // Validate parameters
            if (this._validateParameter(parameters[name], name))
            {
                // Add freeze property
                 // TODO : better "copy" here instead of ... operator ? 
                this.parameters[name]= {...parameters[name], 'freeze' : false};
            }
        }
        if (ParamExplorer.__LOG__)
            console.log(this.parameters);
        return this;
    }

    finalize()
    {
        console.log("ParamExplorer.finalize()");

        // used in manual mode
        this.agentRandom = new RLRandomAgentPython(this);

        // Used in batch / exploration mode
        this.agents = new Map();
        this.agents.set("Agent Random",      new RLRandomAgentPython(this));
        this.agents.set("Agent CMA-ES",      new RLCMAAgentPython(this));
        this.agents.set("Agent Gaussian",    new RLGaussianAgentPython(this));
        this.agents.set("Agent Open-ended",    new RLOpenEndedAgentPython(this));

        // Set
        this.setAgent("Agent Random"); // default selected agent here
        return this;
        
    }

    setAgent(agentId)
    {
        this.currentAgentId = agentId;
        this.agent = this.agents.get(agentId);
    }

    async changeAgent(agentId)
    {
        // Call to server
        this.setAgent(agentId);
        await call('agent/change', {
            'id'                : this.id,
            'session_id'        : this.session_id,
            'agent_name'        : this.agent.name,
            'parameters_def'    : this.getParametersDef()
        });
        return this;
    }

    updateUserObj(obj)
    {
        for (let name in this.parameters)
        {
            let param = this.parameters[name];
            if (param.obj!=globalThis) param.obj = obj;
        }
    }

    beginUseAgentRandom()
    {
        this.agentSaved = this.agent;
        this.agent = this.agentRandom;
        return this;
    }

    endUseAgentRandom()
    {
        this.agent = this.agentSaved;
        return this;
    }

    run()
    {
        if (!this.batch_running)
            this.batch_running = true;
        return this;
    }

    isRunning()
    {
        return this.batch_running;
    }

    async play(batch_size=1, opts={})
    {
        if (!this.batch_running) return this;
        if (ParamExplorer.__LOG__)
        {
            console.group(`paramExplorer.play()`)
        }

        // Limit batch size
        this.batch_size = Math.max(1,Math.min(batch_size,ParamExplorer.BATCH_SIZE_MAX));
        if (this.agent)
        {
            // Agent play
            // returns new values (only) + metadata
            let agent_results = await this.agent.play(opts);
            if (ParamExplorer.__LOG__)
            {
                console.log(`— Agent "${this.agent.name}" results`, agent_results);
                console.log(agent_results.parameters);
                console.log(agent_results.metadata);
            }

            // Apply values to parameters
            for (let name in agent_results.parameters)
            {
                let obj = this.parameters[name]['obj'];
                if (obj)
                {
                    obj[name] = agent_results.parameters[name];
                    if (ParamExplorer.__LOG__ && false)
                        console.log(`updating value for ${name} to ${agent_results.parameters[name]}`)
                }
                else 
                {
                    console.warn(`error updating value for ${name}, 'obj' not defined`);
                }

            }

            // Log
            if (ParamExplorer.__LOG__)
            {
                console.log('— Parameters', this.parameters);
                console.groupEnd();
            }

            return agent_results;
        }

        if (ParamExplorer.__LOG__)
        {
            console.log('agent not set ?!!');
            console.groupEnd();
        }

        return null;
    }

    // Copy & Accumulate parameters in batch_parameters
    step(opts={})
    {
        if (!this.batch_running) return;

        // Save
        // batch_parameters have to be validated with a score
        this.batch_parameters.push( this.copyParametersWithValues(opts) );

        // Agent metadata during play()
        this.batch_metadata.push( opts.metadata??{} );

        // Next
        this.batch_index++;
        if (this.batch_index<this.batch_size)
        {
            if (isFunction(opts.done))  opts.done(this.batch_index, this.batch_size);
        }
        else 
        {
            this.batch_running = false;
            if (isFunction(opts.finished))  
                opts.finished()
        }
    }

    async update()
    {
        if (ParamExplorer.__LOG__)
        {
            console.group(`ParamExplorer.update()`);
            console.log(`loading data for id="${this.id}" and session_id="${this.session_id}"`)
        }

        let result = await call('load_data', {'id': this.id, 'session_id':this.session_id});
        if (result.status == "ok")
        {
            if (this.agent)
            {
                if (ParamExplorer.__LOG__)
                    console.log(`updating agent "${this.agent.name}" on ${result.imagesInfos.length} image(s)`);
                await this.agent.update(result.imagesInfos);
            }
        }
        if (ParamExplorer.__LOG__)
            console.groupEnd();
    }


    async updateScore(image_id, score, opts={})
    {
        if (ParamExplorer.__LOG__)
            console.group(`ParamExplorer.updateScore(${image_id}, ${score})`);

        let data = 
        {
            'id'                : this.id,
            'session_id'        : this.session_id,
            'image_id'          : image_id, 
            'score'             : score
        };

        let result = await call('update_score', data);
        if (ParamExplorer.__LOG__)
            console.log("result=", result);

        if (result.status == "ok")
        {
            // Update
            if (ParamExplorer.__LOG__)
                console.log("updateSCORE OK");

            let imageInfos = result.image_infos;
            await this.agent.update(imageInfos);

            // Call user function
            if (isFunction(opts.done)) 
                opts.done();
        }

        if (ParamExplorer.__LOG__)
            console.groupEnd();
    }

    async save(opts={})
    {
        let result = await call('save', {
            'id'                : this.id,
            'session_id'        : this.session_id,
            'batch_parameters'  : this.batch_parameters,
            'batch_metadata'    : this.batch_metadata
        });

        if (ParamExplorer.__LOG__)
        {
            console.log(`ParamExplorer.save() ${result.status}`);
            if (result.status=='error') console.log(result.message)
        }
        
        if (result.status === 'ok') 
        {
            this.reset();    // or at least: this.batch_parameters = []; this.batch_index = 0;
            console.log("ParamExplorer.save() done");
        }

        // Call use func
        if (isFunction(opts.done)) opts.done( result.status )
    }

    async saveSingle(parametersValues, score, metadata={})
    {
        parametersValues['score'] = score;

        let result = await call('save', {
            'id'                : this.id,
            'session_id'        : this.session_id,
            'batch_parameters'  : [parametersValues],
            'batch_metadata'    : [metadata]
        });


        if (ParamExplorer.__LOG__)
        {
            console.log(`ParamExplorer.saveSingle() ${result.status}`);
            if (result.status=='error') console.log(result.message)
        }

        if (result.status == "ok")
        {
            let imagesIds = result.images_ids;
            return imagesIds[0];
        }

        return null;
    }

    _validateParameter(param, name)
    {
        // Mandatory fields
        // TODO : include log when failing
        if ('type' in param === false) 
            return false;

        // Types supported
        if (ParamExplorer.PARAMETERS_TYPE.includes(param.type) === false) 
            return false;

        // Fine tune check
        // float -> range is mandatory
        if (param.type == 'float' && Array.isArray(param.range)==false)
            return false;

        // choice -> values is mandatory
        if (param.type == 'choice' && Array.isArray(param.choices)==false)
            return false;

        // Check for obj
        if (param.obj === undefined)
        {
            param.obj = globalThis; // globalThis = objet le plus haut en JS
            console.warn(`_validateParameter(${name}), obj was undefined, setting to globalThis`);
        }

        return true;
    }

    copyParametersWithValues(opts={})
    {
        // Copy parameters
        let parametersCopy = {}            
        for (let name in this.parameters)
        {
            // TODO : do we need to copy obj && freeze here ? 
            parametersCopy[name]            = {...this.parameters[name]};
            
            // Grab the value
            parametersCopy[name]['value']   = this.parameters[name]['obj'][name];

            // Remove unnecessary informations
            // TODO : type dependance of properties
            let propsRemove = opts.propsRemove??['obj', 'labels-range', 'labels'];
            //propsRemove.forEach( p => parametersCopy[name][p]=undefined )
            propsRemove.forEach( p => delete parametersCopy[name][p] )
        }

        // Save image
        if (opts.canvas)
        {
            parametersCopy['image_data']        = opts.canvas.toDataURL("image/jpeg").split(';base64,')[1];
            parametersCopy['image_timestamp']   = Date.now();
        }
        return parametersCopy;
    }

    getParametersDef()
    {
        let parametersCopy = this.copyParametersWithValues();
        for (let name in parametersCopy)
            delete parametersCopy[name]['value'];
        return parametersCopy;
    }

    createGroups(groups=[])
    {
        this.groups = groups;
        return this;
    }
}