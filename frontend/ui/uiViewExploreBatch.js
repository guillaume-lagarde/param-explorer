class UIViewExploreBatch extends UIViewCanvas
{
    static __LOG__              = true;

    // ----------------------------------------------------
    constructor(pe, opts={})
    {
        super('view-explore-batch', opts);

        this.paramExplorer  = pe;
        this.batchSize      = 3;

        this.canvasBackgroundColorDefault = opts.canvasBackgroundColorDefault??"#000";
    }

    // ----------------------------------------------------
    reset()
    {
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
                this.canvas = createSketch(sketch, this.canvasWidth,this.canvasHeight, 'view-explore-batch', 'canvas-explore-batch');
            }

            sketch.draw = async () => 
            {
                if (UIViewExploreBatch.__LOG__)
                    console.log('UIViewExploreBatch.draw(), paramExplorer.isRunning() ? '+this.paramExplorer.isRunning())

                sketch.background(this.canvasBackgroundColorDefault);

                if (!this.paramExplorer.isRunning()) return;

                // Draw text on sketch
                this.drawSketchTextCentered(sketch);

                // Recreate an artwork with new user seed
                let artwork = setupArtwork(true);

                // Pass par explorer
                this.paramExplorer.updateUserObj(artwork);

                // Play
                // = Agent play (agent set parameters values and return agent metadata)
                let {parameters, metadata} = await this.paramExplorer.play(this.batchSize);

                // Draw the result with new parameters set
                await drawArtwork(sketch);

                // Save metadata for artwork itself
                if (isFunction(getArtworkData))
                    metadata['artwork'] = getArtworkData();

                // One step forward = push in batch_parameters
                this.paramExplorer.step(
                {
                    'metadata'  : metadata, 
                    'canvas'    : this.canvas.elt,
                    'done'      : (batch_index, batch_size) => 
                    { 
                        // Redraw 
                        globalThis.setTimeout(this.sketch.draw,500)  
                    },
                    'finished': async _ =>
                    {
                        if (UIViewExploreBatch.__LOG__)
                            console.log('batch finished')

                        // Set score to -1 (means not set)
                        this.paramExplorer.batch_parameters.forEach( p => p['score'] = -1 );

                        // Save batch + images
                        await this.paramExplorer.save();

                        // update UI
                        this.updateLayout();
                        await uiViewGallery?.load();
                    }
                });

            }

                    // -------------- NEW: keyboard shortcuts for timeWarp --------------
            sketch.keyPressed = async () =>
            {
                const agent = this.paramExplorer?.agent;
                if (!agent || typeof agent.timeWarp !== "function") return;

                if (sketch.key === 'f' || sketch.key === 'F') {
                    console.log("timeWarp(+1)");
                    await agent.timeWarp(1);
                } else if (sketch.key === 'b' || sketch.key === 'B') {
                    console.log("timeWarp(-1)");
                    await agent.timeWarp(-1);
                }
            };
            // -------------------------------------------------------------------
        });


        this.containerBatch = new UIContainerFoldable({'label' : 'Batch generation'})

        this.pDescription = UI.p().addClass(['discreet']);

        this.selectAgent = new UISelect({'label':'Agent'})
        this.selectAgent.addClass('mb');
        this.selectAgent.add(this.paramExplorer.agents,{'fromKeys':true}).change( async val=>
        {
            await this.paramExplorer.changeAgent(val);
            await this.paramExplorer.update();
        })

        this.sliderBatchSize = UI.slider({'label':'Batch size', 'min':1, 'max':12, 'step':1}).setType(UISlider.INT);
        this.sliderBatchSize.val(this.batchSize)
        this.sliderBatchSize.change( val=>this.batchSize=parseInt(val) )

        this.btnRunBatch = new UIButtonLoader({'label':'Run batch'});
        this.btnRunBatch.click( async _=>
        {
            this.disable();

            this.btnRunBatch.start();
            if (this.paramExplorer)
            {
                this.paramExplorer.reset().run();
                this.updateLayout();
                await this.sketch.draw();
            }
        });

        this.containerBatch.child_([this.selectAgent, this.pDescription,this.sliderBatchSize, this.btnRunBatch])
        this.container.child(this.containerBatch);


        this.updateLayout();
    }

    // ----------------------------------------------------
    updateLayout()
    {
        this.selectAgent.val(this.paramExplorer.currentAgentId);
        this.pDescription.text(this.paramExplorer?.agent.getDescription());
        this.btnRunBatch.enable( !this.paramExplorer.isRunning() );
        if (!this.paramExplorer.isRunning())
        {
            this.enable();
            this.btnRunBatch.stop();
        }
    }
}