class UIViewExploreManual extends UIViewCanvas
{
    static __LOG__ = true;

    // ----------------------------------------------------
    constructor(pe,opts={})
    {
        super('view-explore-manual', opts);

        this.paramExplorer  = pe; 
        this.currentParametersValues = null;
        this.currentMetadata = null;
        this.userParams     = {};

        this.canvas         = null;
        this.canvasWidth    = opts.canvasWidth??500;
        this.canvasHeight   = opts.canvasHeight??500;

        this.canvasBackgroundColorDefault = opts.canvasBackgroundColorDefault??"#000";

        // Parameters were set from "outside" (gallery image)
        this.bEditMode      = false;

        // Skip first draw of canvas (TOFIX : not sure why sketch.draw() is called even if sketch.noLoop() was called)
        this.bSkipFirstDraw     = true;
    }
    
    // ----------------------------------------------------
    reset()
    {
        this.currentParametersValues = null;
        this.currentMetadata = null;
        this.bEditMode      = false;
        this.userParams     = {};
        this.containerInfos?.hide(); 
        this.containerPE?.hide();
        this.sketch?.background(this.canvasBackgroundColorDefault);
    }

    // ----------------------------------------------------
    create()
    {       
        super.create();

        // Set up our own renderer
        this.p5 = new p5( sketch => 
        {
            this.sketch = sketch;

            sketch.setup = () => 
            {
                this.canvas = createSketch(sketch, this.canvasWidth,this.canvasHeight, 'view-explore-manual', 'canvas-explore-manual');
            }

            sketch.draw = async () => 
            { 
                if (this.bSkipFirstDraw)
                {
                    sketch.background(this.canvasBackgroundColorDefault);
                    this.bSkipFirstDraw = false;
                    return;
                }          

                if (UIViewExploreManual.__LOG__){
                    console.group( `UIViewExploreManual, sketch.draw()` );
                    console.log(`calling drawArtwork()`);
                }
                
                sketch.background(this.canvasBackgroundColorDefault);
                this.drawSketchTextCentered(sketch);
                await drawArtwork(sketch);

                if (UIViewExploreManual.__LOG__) console.groupEnd();
            }
        });

        // GENERATE
        this.containerGenerate = UI.div().addClass(['container'])

        // Btn generate => new iteration with random parameters
        this.btnGenerate = new UIButtonLoader({'label' : 'Generate'})
        this.btnGenerate.click( async _=>
        {
            this.disable();

            this.btnGenerate.start();

            // Not in edit mode
            this.bEditMode = false;

            // Reset user params
            this.userParams     = {};

            // Recreate an artwork with new user seed
            let artwork = setupArtwork(true);

            this.paramExplorer.updateUserObj(artwork);

            // Compute new params with the random agent from explorer
            this.paramExplorer.beginUseAgentRandom();
            this.paramExplorer.run();

            // Get the parameters & metadata
            // Save current metadata (ie agent data)
            let {parameters,metadata} = await this.paramExplorer.play(); // will create a new seed inside agent random
            this.currentMetadata = metadata;
            this.currentMetadata["agent_name"] = "manual";

            // Redraw
            await this.sketch.draw();

            // Save the seed
            // if we want to update the parameters : same seed and then change manually our params 
            // TODO : uniformize this with agent state ? 
            this.currentParametersValues = this.paramExplorer.copyParametersWithValues({'canvas':this.canvas.elt});

            // Restore agent in use for batch exploration
            this.paramExplorer.endUseAgentRandom();

            // update controls
            uiUpdateControlsFromParamsExplorer(this.uiParams);

            this.btnGenerate.stop();
            this.enable();
            this.updateLayout();
        });

        this.containerGenerate.child(this.btnGenerate);


        // INFOS
        this.containerInfos = UI.div();
        this.pInfos = UI.p().addClass(['infos', 'small'])

        this.teScore = createUITextEditScore('teScore-manual', async score=>
        {
            if ( UIViewExploreManual.__LOG__)
                console.group(`UIViewExploreManual, updating score from text edit, score=${score}`);

            // Save it
            if (this.bEditMode == false)
                this.paramExplorer.beginUseAgentRandom();
            
            // Metadata
            let metadata = this.currentMetadata??{};
            if (isFunction(getArtworkData))
                metadata['artwork'] = getArtworkData();

            let image_id = await this.paramExplorer.saveSingle(this.currentParametersValues, score, metadata);
            
            if (this.bEditMode == false)
                this.paramExplorer.endUseAgentRandom();

            // New score -> Update param explorer
            //await this.paramExplorer.update();
            if (image_id)
            {
                if ( UIViewExploreManual.__LOG__)
                    console.log("image_id=", image_id);
                await this.paramExplorer.updateScore(image_id, score);
            
                // update UI
                await uiViewGallery?.load();
            }
            else 
            {
                if ( UIViewExploreManual.__LOG__)
                    console.log("no image_id, something might have gone wrong ...");
            }

            if ( UIViewExploreManual.__LOG__)
                console.groupEnd();
        });
        this.teScore.hide();

        this.containerInfos.child([this.teScore,this.pInfos])

        // PARAMETERS
        this.containerPE    = new UIContainerFoldable({'label' : 'Parameters'})
        this.uiParams       = new UIParams();

        // Callback for user input
        // TODO : for freeze 
        let uiParamsChange = async (name,val) => 
        {
            // Save value
            this.userParams[name] = val;

            // Create artwork -> do not regenerate user seed
            let artwork = setupArtwork(false);
            this.paramExplorer.updateUserObj(artwork);



            // apply the modified params
            // overwrite randomly generated ones
            for (let name in this.userParams)
            {
                // Get param
                let param = this.paramExplorer.parameters[name];

                // Update value
                param['obj'][name] = this.userParams[name];
            }

            // redraw now with random + user params
            this.sketch.draw();

            // Get Parameters value to be saved
            this.currentParametersValues = this.paramExplorer.copyParametersWithValues({'canvas':this.canvas.elt});

        };

        // Create controls from params
        this.uiParams.child( uiCreateControlsFromParamsExplorer(this.paramExplorer, uiParamsChange) );


        // DOM
        this.containerPE.child_([this.uiParams])
        this.container.child([this.containerGenerate,this.containerInfos, this.containerPE]);
        
        this.updateLayout();
    }

    // ----------------------------------------------------
    viewArtworkWithParameters(params={}, metadata={})
    {
        if (UIViewExploreManual.__LOG__)
        {
            console.group(`UIViewExploreManual.viewArtworkWithParameters()`)
            console.log(`params`, params);
        }
        this.bEditMode = true;

        // Create artwork -> regenerate user seed though we do not care here
        if ('setArtworkData' in globalThis && isFunction(setArtworkData))
            setArtworkData(metadata['artwork']??{});
        let artwork = setupArtwork(false); // false because seed should be in metadata now
        this.paramExplorer.updateUserObj(artwork);
        
        // Set the values from params
        for (let name in params)
        {
            let param = this.paramExplorer.parameters[name];
            if (param)
                param['obj'][name] = params[name].value;
            else 
                console.warn(`cannot find ${name}`);
        }

        // Copy values in user params (seems legit)
        for (let name in params)
            this.userParams[name] = params[name].value;        

        // redraw now with predefined params
        this.sketch.draw();

        // Get Parameters value to be saved
        this.currentParametersValues = this.paramExplorer.copyParametersWithValues({'canvas':this.canvas.elt});
    
        // Update UI
        uiUpdateControlsFromParamsExplorer(this.paramExplorer);
        this.updateLayout();

        if (UIViewExploreManual.__LOG__)
        {
            console.groupEnd();
        }
    }

    // ----------------------------------------------------
    updateLayout()
    {
        if (this.bEditMode == false && this.currentMetadata == null)
        {
            this.containerPE.hide();
            return;
        }

        this.containerPE.show();
        this.containerInfos.show();
        this.teScore.val('').show();
        this.pInfos.text('');

        if (this.bEditMode)
        {
            this.pInfos.text(`Edit from the gallery`);
        }
        else
        {
            if (this.currentMetadata)
            {
                this.pInfos.text(`Generated with agent '${this.paramExplorer.agentRandom.name}'<br /><br />${this.paramExplorer.agentRandom.getDescription()}`);
            }
        }
    }
}

