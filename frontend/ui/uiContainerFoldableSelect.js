class UIContainerFoldableSelect extends UIContainerFoldable
{
    constructor(opts={})
    {
        super(opts);
        this.containerElements = UI.div().class("container container-for-select");
        if (opts.mapElements)
            this.setElements(opts.mapElements)

    }
    
    hideElementsAll()
    {
        this.mapElements.forEach( elmt => { if (elmt) elmt.hide() } );
    }

    setElements(mapElements)
    {
        this.mapElements = mapElements;

        this.selectElements = UI.select({"label" : "Choose"});
        this.selectElements.add(this.mapElements,{"fromKeys" : true}).addClass("mb");
        this.mapElements.forEach( container=>this.containerElements.child(container) )
        this.selectElements.change( _ => 
        {
            let v = this.selectElements.val();
            this.showElement(v);
            if (this.cbChange)
                this.cbChange(v, "select");
        });
        this.child_([this.selectElements,this.containerElements]);
        this.hideElementsAll();
        return this;
    }

    showElement(v)
    {
        this.hideElementsAll();
        let elmt = this.mapElements.get(v);
        if (elmt)
            elmt.show();
    }

    childElement(elmt)
    {
        if (elmt)
        {
            if (this.containerElements)
            {
                if (Array.isArray(elmt))
                    elmt.forEach( e => this.containerElements.child(e) );
                else
                    this.containerElements.appendChild(elmt);
            }
            else
            {
                this.child_(elmt);
            }
        }
        return this;
    }

    change( cb )
    {
        this.cbChange = cb;
        return this;
    }

    val(v)
    {
        if (this.selectElements)
        {
            this.showElement(v);
            return this.selectElements.val(v);
        }
        return this;
    }
}