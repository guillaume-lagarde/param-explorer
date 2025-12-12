class UIContainerFoldable extends UIElement
{
    constructor(opts={})
    {
        super("div", opts);
        this.class("container foldable");

        this.lbl = UI.label().text(opts.label ?? "Container foldable").class("underline");
        this.lbl.elmt().addEventListener("click", e=> this.toggle());

        this.container = UI.div().class("container");
        this.bOpened = true;

        this.child( [this.lbl,this.container] );

    }

    setTitle(s)
    {
       this.lbl.text(s); 
    }

    hideTitle()
    {
        this.lbl.hide();
        return this;        
    }

    setCbToggle(cbToggle)
    {
        if (isFunction(cbToggle))            
            this.cbToggle = cbToggle;
    }

    close()
    {
        this.bOpened = false;
        this.container.hide();
    }

    update()
    {
        if (this.bOpened)
            this.container.show();
        else 
            this.container.hide();
    }

    toggle()
    {
        this.bOpened = !this.bOpened;
        this.update();        
        if (this.cbToggle) 
            this.cbToggle();
    }
    
    child_(elmt)
    {
        if (elmt)
        {
            if (Array.isArray(elmt))
                elmt.forEach( e => this.container.child(e) );
            else
                this.container.appendChild(elmt);
        }
        return this;
    }

    getState()
    {
        return {'opened':this.bOpened};
    }

    setState(state)
    {
        if (state.opened !== undefined)
        {
            this.bOpened = state.opened;
            this.update();
        }
    }
}