class UISelectCheckbox extends UIElementFreeze
{
    constructor(name, parameter, opts={'bShowFreeze':false})
    {
        super(name,parameter,opts);
        this.addClass('select-chk');

        this.name       = name;
        this.parameter  = parameter;

        // Create controls
        this.label          = UI.label().text(name).addClass('mb');
        this.container      = UI.div().addClass(['flex', 'container-select-chk'])
        this.selectValue    = UI.select({'noLabel':true});
        this.createChk();

        let m = new Map();
        for (let value in parameter.choices)
        {
            let lbl = parameter.labels ? parameter.labels[value] : `Value ${value}`;
            m.set(lbl,value)
        } 
        this.selectValue.add(m);

        // Change callbacks
        this.selectValue.change ( value         => this?.cbChange( name, int( value ) ) );
    
        // Build
        this.container.child([this.selectValue, this.chkFreeze])
        this.child([this.label, this.container]);
    }

    setLabel(label)
    {
        this.label.text(label);
    }

    updateLayout()
    {
        this.selectValue.val( this.parameter['obj'][this.name] );
        super.updateLayout();
    }
}