class UITextInput extends UIElement
{
    constructor(opts={})
    {
        super("div", opts);
        this.class("text-input");

        this.lbl            = UI.label().text( opts.label || "???" );
        this.te             = UI.input("text", opts);

        this.create();

        this.bStopPropagation = true;

        if (this.bStopPropagation)
            this.te.elmt().addEventListener("click", e=> e.stopPropagation() );

    }

    create()
    {
        this
        .child( this.lbl )
        .child( this.te )
    }

    label(s)
    {
        this.lbl.text(s);
        return this;
    }

    disable(is=true)
    {
        this.te.elmt().disabled = is;
        is ? this.addClass('disabled') : this.removeClass('disabled');
        return this;
    }

    change( cb )
    {
        this.te.elmt().addEventListener("keydown", e=>
        {
            if (this.bStopPropagation)
                e.stopPropagation();
        })
        this.te.elmt().addEventListener("change", cb)
        return this;
    }


    val(v)
    {
        let elmt = this.te.elmt();
        if (arguments.length == 0)
            return elmt.value;        
        else
            elmt.value = v; 
        return this;
    }
}