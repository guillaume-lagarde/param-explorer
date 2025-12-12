class UIViewGallery extends UIElement
{
    static __LOG__                  = true;

    static FILTER_TIMESTAMP_ASC     = 0; // newer to older
    static FILTER_NO_SCORE          = 1; // no score atm
    static FILTER_SCORE_DESC        = 2;
    static FILTER_AGENT             = 3;
    static NB_MAX_COLUMNS           = 8;

    static IMAGE_RESIZE_TARGET_WIDTHS = [256, 512, 1024]; // same as backend/utils_image.py

    // https://lucide.dev/
    static SVG_EYE                  = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-eye-icon lucide-eye"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>';
    static SVG_PENCIL               = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-pencil-icon lucide-pencil"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></svg>';
    static SVG_IMG_DOWNLOAD         = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-down-to-line-icon lucide-arrow-down-to-line"><path d="M12 17V3"/><path d="m6 11 6 6 6-6"/><path d="M19 21H5"/></svg>';
    
    static COLOR_INFOS_LIGHT        = {
            'stroke'        : '#FFF',
            'background'    : '#FFF',
            'color'         : '#000'        
    }

    static COLOR_INFOS_DARK        = {
            'stroke'        : '#000',
            'background'    : '#000',
            'color'         : '#FFF'        
    }    

    // ----------------------------------------------------
    constructor(opts={})
    {
        super("div", opts);
        this.id('view-gallery').addClass('view');

        this.bFlex = true;
        this.bShowScore = true;
        this.bShowAgent = true;
        this.imgSelectedData = null;
        this.nbColumns = 4;

        this.setImageInfosColors(opts.imagesInfosColors == "dark" ? UIViewGallery.COLOR_INFOS_DARK : UIViewGallery.COLOR_INFOS_LIGHT);

        // Filters
        this.currentFilterId        = 1;
        // Filter by score
        this.filterScoreMinValue    = 0;
        // Filter by agent
        this.filterAgentName        = "";
        this.filterAgentMaxPerPopIdx= 5;

        // set of selected IDs (multi-selection)
        this.selectedImages = new Set();

        // keyboard + mouse handlers bound to this
        this._onKeyDown     = this._onKeyDown.bind(this);
        this._onClick       = this._onClick.bind(this);
    }

    // ----------------------------------------------------
    setImageInfosColors(which=UIViewGallery.COLOR_INFOS_LIGHT)
    {
        this.imgInfosColors = which;
    }

    // ----------------------------------------------------
    show()
    {
        document.addEventListener('keydown', this._onKeyDown);
        this.elmt().addEventListener('click', this._onClick, false);
        super.show();
    }

    // ----------------------------------------------------
    hide()
    {
        document.removeEventListener('keydown', this._onKeyDown);
        this.elmt().removeEventListener('click', this._onClick);
        super.hide();
    }

    // ----------------------------------------------------
    create()
    {       
        this.containerGallery = UI.div().addClass('container-gallery');


        this.containerImages        = UI.div().addClass('images');
        this.containerImagesEmpty   = UI.div().addClass('images-empty').hide();

        this.containerGallery.child([this.containerImages,this.containerImagesEmpty]);
        this.child(this.containerGallery);

        this.sliderNbColumns    = UI.slider({'label':'Columns', 'min':1, 'max':UIViewGallery.NB_MAX_COLUMNS}).setType(UISlider.INT).step(1).change( val=>
        {
            // Data
            this.nbColumns = val;

            // Columns
            document.querySelectorAll('.images-group').forEach(el =>el.style.gridTemplateColumns = `repeat(${val}, 1fr)` );            
            
            // Adapt sizes of images
            const groups = document.querySelectorAll('.images-group');
            groups.forEach( groupEl=>{
                const images = groupEl.querySelectorAll('img');
                const sizesAttr = this.generateSizes(this.nbColumns, 10);
                images.forEach(img => img.sizes = sizesAttr );
            })            

        });
        this.sliderNbColumns.val( this.nbColumns );

        this.containerInfos     = UI.div().addClass(['ui','container-bg','user']); 

        this.mapFilterTitlesToId = new Map();
        this.mapFilterTitlesToId.set('Images by timestamp DESC',    UIViewGallery.FILTER_TIMESTAMP_ASC);
        this.mapFilterTitlesToId.set('Images with no score',        UIViewGallery.FILTER_NO_SCORE);
        this.mapFilterTitlesToId.set('Images by score DESC',        UIViewGallery.FILTER_SCORE_DESC);
        this.mapFilterTitlesToId.set('Images by agent',             UIViewGallery.FILTER_AGENT);

        // Filters
        let mapFilterElements = new Map();
        this.mapFilterTitlesToId.forEach( (v,k)=>
            {
                let div = UI.div();
                if (v == UIViewGallery.FILTER_SCORE_DESC)
                {
                    // Slider to filter by score
                    div.id('container-filter-score-desc');
                        let sliderFilterScoreMin = UI.slider({'label':'Score min.', min:0, max:100}).change( async val=>
                        {
                            this.filterScoreMinValue = ++val;
                            await this.load();
                            this.unselectAllImages();
                        });
                        sliderFilterScoreMin.val(this.filterScoreMinValue);
                    div.child(sliderFilterScoreMin);
                }
                else if (v == UIViewGallery.FILTER_AGENT)
                {
                    div.id('container-filter-agent');
                        // Select agent name
                        let filterSelectAgentName = new UISelect({'label':'Agent'})
                        filterSelectAgentName.addClass('mb');
                        filterSelectAgentName
                        .add(paramExplorer.agents,{'fromKeys':true})
                        .change( async val=>
                        {
                            let agent = paramExplorer.agents.get(val);
                            if (agent)
                            {
                                this.filterAgentName = agent.name;
                                await this.load();
                                this.unselectAllImages();
                            }
                        })

                        // Max pop idx
                        let filterSliderAgentMaxPopIdx = UI.slider({'label':'Max. drawings per group','min':3, 'max':16, 'step':1});
                        filterSliderAgentMaxPopIdx.change( async val => 
                        {
                                this.filterAgentMaxPerPopIdx = Math.floor(val);
                                await this.load();
                                this.unselectAllImages();
                        })
                        filterSliderAgentMaxPopIdx.val( this.filterAgentMaxPerPopIdx );

                    div.child([filterSelectAgentName, filterSliderAgentMaxPopIdx]);
                }

                mapFilterElements.set(k,   div);            
        } );


        this.containerFilters   = new UIContainerFoldableSelect({'label' : 'Filter'});
        this.containerFilters.setElements(mapFilterElements).change( async val=>
        {

            // Filter
            this.currentFilterId = this.mapFilterTitlesToId.get(val);

            // Reload with filter
            await this.load();

            // Temp
            // TODO : better way to do this
            this.containerFilters.containerElements.hide();
            if (this.currentFilterId == UIViewGallery.FILTER_SCORE_DESC || this.currentFilterId == UIViewGallery.FILTER_AGENT)
                this.containerFilters.containerElements.show();

            // Cancel selected
            this.unselectAllImages();
        })
    
        this.containerFilters.containerElements.hide();
    


        // Infos
        this.divInfos           = new UIContainerFoldable({'label' : 'Infos'})
        this.kvInfos = new UIKeyValues();

        this.teScore = createUITextEditScore('teScore-gallery', async score =>
        {
            // 1) If several images are selected → same score for all
            if (this.selectedImages.size > 0) {
                await this._setScoreSelectedImages(score);
                return;
            }

            // 2) Fallback: only the “current” image
            if (this.imgSelectedData?.id) {
                await paramExplorer.updateScore(this.imgSelectedData.id, score);
                await this.load();

                if (UIViewGallery.__LOG__)
                    console.log(
                        `UIViewGallery(), teScore change, updated score for image ${this.imgSelectedData.id}`
                    );
            }
        });


        this.containerInfos.child([this.sliderNbColumns,this.containerFilters, this.divInfos]);
        this.divInfos.child([this.kvInfos, this.teScore]);
        this.divInfos.hide(); 

        this.child([this.containerInfos]);

        this.updateLayout();

        // util functions for icon Click
        let findImg = e=>{
            let wrapper = e.target.closest(".img-wrapper");
            return wrapper?.querySelector("img");
        }
        let getImageSrc = e =>{ return findImg(e)?.dataset?.url }
        let getImageId  = e =>{ return findImg(e)?.dataset?.id }

        // listen for clicks on the grid (once here)
        this.containerImages.elmt().addEventListener("click", e => 
        {
            // Click on eye
            const eye = e.target.closest(".img-view");
            if (eye)
            {
                let image_id = getImageId(e);
                if (image_id)
                {
                    uiViewGalleryImage.show( this.getImageSrcById( image_id ) );
                    return;
                }
            }

            // Click on pencil
            const edit = e.target.closest(".img-edit");
            if (edit)
            {
                let image_id = getImageId(e);
                if (image_id)
                {
                    uiEditImageManual(paramExplorer.session_id, image_id);
                    return;
                }
            }

            // Click on download
            const download = e.target.closest(".img-download");
            if (download)
            {
                let image_id = getImageId(e);
                if (image_id)
                {
                    const a = document.createElement("a");
                    let imgSrc = getImageSrc(e);
                    if (imgSrc)
                    {
                        a.href = imgSrc;
                        a.download = imgSrc.split('/').pop();
                        a.click();
                    } 
                }
            }


            // Click on image
            const wrapper = e.target.closest(".img-wrapper");

            // Outside click : unselect all
            if (!wrapper) 
            {
                this.unselectAllImages();
                return;
            }

            // "click“ not going to the view
            e.stopPropagation();

            // Clicke image
            const img = wrapper.querySelector("img");
            if (!img) return;

            const id = img.dataset.id;

            // Ctrl/Cmd + click => multi-selection (toggle)
            if (e.ctrlKey || e.metaKey) {
                if (this.selectedImages.has(id)) {
                    this.selectedImages.delete(id);
                } else {
                    this.selectedImages.add(id);
                }
            } else {
                // simple click => single selection
                this.selectedImages.clear();
                this.selectedImages.add(id);
            }

            // "active" image for the info panel
            this.imgSelectedData = img.dataset;
            this.updateLayoutImg(img);        
    });
    
    }

    // ----------------------------------------------------
    async load(opts={})
    {

        let svgReplaceStroke = (svg,strokeColor)=>{
            return svg.replace(/stroke="[^"]*"/g, `stroke="${strokeColor}"`);
        }

        let call_data = {'session_id':__UI_PARAM_EXPLORER__.session_id, 'filter_id':this.currentFilterId};

        if (this.currentFilterId == UIViewGallery.FILTER_SCORE_DESC)
        {
            call_data['score_min'] = this.filterScoreMinValue;
        }
        else if (this.currentFilterId == UIViewGallery.FILTER_AGENT)
        {
            call_data['agent_name']         = this.filterAgentName;
            call_data['agent_max_pop_idx']  = this.filterAgentMaxPerPopIdx;
        }


        this.containerImagesEmpty.hide();
        this.containerImagesEmpty.elmt().innerHTML = "";

        let result = await call('load_gallery', call_data);
        if (result.status == "ok")
        {
            this.containerImages.elmt().innerHTML = "";

            // Check if empty
            let nbImages = 0;
            result.imagesInfos.forEach( infoArray=> nbImages+=infoArray.length );

            if (nbImages == 0)
            {
                this.containerImages.hide();
                this.containerImagesEmpty.elmt().innerHTML = `<div class="content">No images found</div>`;
                this.containerImagesEmpty.show();
                return;
            }
            else 
            {
                this.containerImages.show();
            }


            // Extract infos
            let contentContainer = "";
            result.imagesInfos.forEach( infoArray => 
            {
                contentContainer += `<div class="images-group-wrapper">`;
                if (this.currentFilterId == UIViewGallery.FILTER_AGENT)
                    if ('pop_idx' in infoArray[0].metadata)
                        contentContainer += `<div class="group-label">Group ${infoArray[0].metadata.pop_idx}</div>`;

                contentContainer += `<div class="images-group">`;
                let content="";
                infoArray.forEach( info=> 
                {
                    let contentInfos = '';
                    let style_sticker = `background-color:${this.imgInfosColors.background};color:${this.imgInfosColors.color}`;

                    let contentScore = '';
                    if (this.bShowScore && info.score>=0)
                        contentScore = `<div class="img-sticker" style="${style_sticker}">${info.score}</div>`;
                    let contentAgent = '';
                    if (this.bShowAgent && info.metadata && info.metadata.agent_name)
                        contentAgent = `<div class="img-sticker" style="${style_sticker}">${info.metadata.agent_name}</div>`;

                    if (contentScore!='' || contentAgent!='')
                        contentInfos = `<div class="img-infos">${contentAgent+contentScore}</div>`;

                    let contentEye      = `<div class="icon img-view">${svgReplaceStroke(UIViewGallery.SVG_EYE,this.imgInfosColors.stroke)}</div>`;
                    let contentEdit     = `<div class="icon img-edit">${svgReplaceStroke(UIViewGallery.SVG_PENCIL,this.imgInfosColors.stroke)}</div>`;
                    let contentDownload = `<div class="icon img-download">${svgReplaceStroke(UIViewGallery.SVG_IMG_DOWNLOAD,this.imgInfosColors.stroke)}</div>`;
                    content+=`<div class="img-wrapper">
                    <img 
                        src="${this.generateSrcForSize(info.url, 1024)}" 
                        srcset="${this.generateSrcSet(info.url, UIViewGallery.IMAGE_RESIZE_TARGET_WIDTHS)}"
                        sizes="${this.generateSizes(this.nbColumns, 10)}"
                        data-score="${info.score}" 
                        data-timestamp="${info.timestamp}" 
                        data-id="${info.id}" 
                        data-url="${info.url}"
                        loading="lazy" 
                        />${contentEye}${contentEdit}${contentDownload}${contentInfos}</div>\n`;
            
                })
                contentContainer += content;
                contentContainer += "</div>";
                contentContainer += "</div>";
            });

            // Fill container with images
            this.containerImages.elmt().innerHTML = contentContainer;
        }
        
        // reapply .selected classes and info panel
        this.updateLayoutImg();

        // Call user func
        if (isFunction(opts.done)) opts.done( result.status )
    }

    // ----------------------------------------------------
    unselectAllImages()
    {

        this.selectedImages.clear();
        this.imgSelectedData = null;
        this.updateLayoutImg();

        /*
        this.containerImages.elmt()
        .querySelectorAll('.img-wrapper')
        .forEach(el => el.classList.remove('selected'));
        */
    }


    // ----------------------------------------------------
    // updates the display of selections + Info panel
    updateLayoutImg(img)
    {
        const root = this.containerImages.elmt();
        if (!root) return;

        // 1) apply 'selected' class based on selectedImages Set
        root.querySelectorAll('.img-wrapper').forEach(wrapper => {
            const image = wrapper.querySelector('img');
            if (!image) return;
            const id = image.dataset.id;
            if (this.selectedImages.has(id)) {
                wrapper.classList.add('selected');
            } else {
                wrapper.classList.remove('selected');
            }
        });

        // 2) manage Info panel (show info for the last clicked image)
        let infoImg = img;

        if (!infoImg && this.imgSelectedData && this.imgSelectedData.id) {
            // try to find the corresponding img in the DOM
            infoImg = root.querySelector(`img[data-id="${this.imgSelectedData.id}"]`);
        }

        if (!infoImg || !this.selectedImages.has(infoImg.dataset.id)) {
            // no active image (or no longer selected) -> hide info
            this.divInfos.hide();
            return;
        }

        this.kvInfos.setVal('Id',   infoImg.dataset.id);
        this.kvInfos.setVal('Date', formatTimestamp(int(infoImg.dataset.timestamp)));
        this.divInfos.show();
    
        this.teScore.val( infoImg.dataset.score >= 0 ? infoImg.dataset.score : '' );
    }

    // ----------------------------------------------------
    // Keyboard handler: if one or more images are selected
    // 'd' → deletion, 's' → score = 100
// ----------------------------------------------------
    _onKeyDown(e)
    {
        if (e.key === 'a' || e.key === 'A') {
            e.preventDefault();
            this.selectAllImages();
            return;
        }

        if (this.selectedImages.size === 0) return;

        if (e.key === 'o' || e.key === 'O') {
            e.preventDefault();
            if (this.selectedImages.size == 1)
            {
                let imgId = this.selectedImages.values().next().value; 
                uiViewGalleryImage.show( this.getImageSrcById( imgId ) );
            }
        }


        if (e.key === 'd' || e.key === 'D') {
            e.preventDefault();
            this._deleteSelectedImages();
        }
        else if (e.key === 's' || e.key === 'S') {
            e.preventDefault();
            this._setScoreSelectedImages(100);
            this.unselectAllImages();
        }
    }




    // ----------------------------------------------------
    _onClick(e)
    {
        this.unselectAllImages();
    }

    // ----------------------------------------------------
    // Delete all selected images (DB + files)
    async _deleteSelectedImages()
    {
        const ids = Array.from(this.selectedImages);
        if (ids.length === 0) return;

        const ok = confirm(`Delete ${ids.length} image(s)? (DB + file)`);
        if (!ok) return;

        try {
            for (const idStr of ids) {
                const id = parseInt(idStr, 10);
                const result = await call('delete_image', {
                    id: id,
                    session_id: __UI_PARAM_EXPLORER__.session_id
                });

                if (result.status !== "ok") {
                    console.error(`Failed to delete image ${id}`, result);
                } else if (UIViewGallery.__LOG__) {
                    console.log(`Image ${id} deleted`);
                }
            }

            // reset selection and reload
            this.selectedImages.clear();
            this.imgSelectedData = null;
            await this.load();
            this.updateLayoutImg(); // to refresh and hide the info panel
        } catch (err) {
            console.error("Error while deleting images", err);
        }
    }

    // ----------------------------------------------------
    // Give a score to all selected images
    async _setScoreSelectedImages(score = 100)
    {
        const ids = Array.from(this.selectedImages);
        if (ids.length === 0) return;

        try {
            for (const idStr of ids) {
                const id = parseInt(idStr, 10);

                // same API as for teScore
                const result = await paramExplorer.updateScore(id, score);

                if (result?.status && result.status !== "ok") {
                    console.error(`Failed to update score for image ${id}`, result);
                } else if (UIViewGallery.__LOG__) {
                    console.log(`Score ${score} applied to image ${id}`);
                }
            }

            // keep the same selection, but reload the data
            await this.load();
            this.updateLayoutImg(); // refresh info panel, .selected classes, etc.

        } catch (err) {
            console.error("Error while updating scores", err);
        }
    }

    // ----------------------------------------------------
    // Select all visible images in the gallery
    selectAllImages()
    {
        const root = this.containerImages.elmt();
        if (!root) return;

        this.selectedImages.clear();

        root.querySelectorAll('.img-wrapper img').forEach(img => {
            this.selectedImages.add(img.dataset.id);
        });

        // update UI
        this.updateLayoutImg();
    }

    // ----------------------------------------------------
    getImageSrcById(id) 
    {
        let img = this.containerImages.elmt().querySelector(`img[data-id="${id}"]`);
        return img ? img.dataset.url : null;
    }

    // ----------------------------------------------------
    updateLayout()
    {
        let kTitle = [...this.mapFilterTitlesToId].find(([k, v]) => v === this.currentFilterId)?.[0];
        this.containerFilters.val(kTitle);
    }

    // ----------------------------------------------------
    resize()
    {
        let w = window.innerWidth;
        if (window.innerWidth<1024) // FIXME : to be coherent with css
        {
            this.sliderNbColumns.enable( false );
            document.querySelectorAll('.images-group').forEach(el => el.style.removeProperty('grid-template-columns') );
        }
        else 
        {
            this.sliderNbColumns.enable( true );
        }
    }

    generateSrcForSize(src, size)
    {
        const lastDot = src.lastIndexOf('.');
        const base = src.slice(0, lastDot);
        const ext  = src.slice(lastDot);
        return `${base}_w${size}${ext}`;
    }

    generateSrcSet(src, sizes) 
    {
        const lastDot = src.lastIndexOf('.');
        const base = src.slice(0, lastDot);
        const ext  = src.slice(lastDot);

        const entries = sizes.map(size => `${base}_w${size}${ext} ${size}w`);

        entries.push(`${src} 1920w`);

        return entries.join(', ');
    }    

    generateSizes(columns, gap = 0) 
    {
        const totalGap = gap * (columns - 1);
        return `calc((100vw - ${totalGap}px) / ${columns})`;
        //return "100vw, 50vw, 25vw, 10vw";
        //return Math.floor(0.8*window.innerWidth/columns)+"w"
    }    
}
