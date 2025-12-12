class UIElementFreeze extends UIElement
{
    constructor(name, parameter, opts={'bShowFreeze':false})
    {
        super('div');
        this.addClass('mb'); // m(argin) b(ottom)

        this.name           = name;
        this.parameter      = parameter;
        this.bShowFreeze    = opts.bShowFreeze??false;
        this.chkFreeze      = null;
        this.cbChange       = null;
    }

    setLabel(label){}

    createChk()
    {
        if (this.bShowFreeze)
        {
            this.chkFreeze = UI.checkbox();
            this.chkFreeze.lbl.hide();
            this.chkFreeze.change  ( bFreeze       => {} ); // TODO : callback here
        }
    }

    change(cbChange)
    {
        this.cbChange = isFunction(cbChange) ? cbChange : null;
        return this;
    }    

    updateLayout()
    {
        this.chkFreeze?.val( this.parameter.freeze );
    }
}