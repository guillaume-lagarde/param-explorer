class UIButton extends UIElement
{
    constructor(opts={})
    {
        super("button", opts);
        if (opts.label)
            this.text(opts.label);
    }

    click(cb)
    {
        this.cb = cb;
        this.elmt().addEventListener("click", this.cb);
        return this;
    }

    removeClick()
    {
        this.elmt().removeEventListener("click", this.cb);
        return this;
    }

    disable(is)
    {
        this.elmt().disabled = is??true;
        return this;
    }

    enable(is)
    {
        if (is || is==undefined)
            return this.disable(false);
        return this.disable(true);
    }

}

class UIButtonLoader extends UIButton
{
    constructor(opts={})
    {
        super(opts);
        this.content = this.elmt().innerHTML;
    }

    start()
    {
        this.load();
    }

    load()
    {
        this.content = this.elmt().innerHTML;
        this.text(`<div class="lds-ring"><div></div><div></div><div></div><div></div></div>`);
        return this;
    }

    stop()
    {
        this.elmt().innerHTML = this.content;
        return this;
    }
}

class UILoaderIcon extends UIElement
{
    constructor()
    {
        // https://loading.io/css/
        super("div")
        this.class("lds-ring");
        this.child( [UI.div(),UI.div(),UI.div(),UI.div()] )
    }

}