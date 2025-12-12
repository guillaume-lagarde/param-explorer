class UISliderCheckbox extends UIElementFreeze
{
    constructor(name, parameter, opts={'bShowFreeze':false})
    {
        super(name, parameter,opts);
        this.addClass('slider-chk');

        this.name       = name;
        this.parameter  = parameter;

        // Create controls
        this.label          = UI.label().text(name).addClass('mb');
        this.container      = UI.div().addClass(['flex', 'container-slider-chk'])
        this.sliderValue    = UI.slider({'hideName' : true, 'min':parameter.range[0], 'max':parameter.range[1]})
        this.sliderValue.step(parameter.type=='float' ? 0.01 : 1);
        this.createChk();

        if ('labels-range' in this.parameter)
        {
            this.sliderValue.lblMin.text(this.parameter['labels-range'][0]);                 
            this.sliderValue.lblMax.text(this.parameter['labels-range'][1]);                 
        }

        // Change callbacks
        this.sliderValue.change( val => 
        {
            this?.cbChange(name,+val);
            this.updateSliderLabel( val );
        });
    
        // Build
        this.container.child([this.sliderValue, this.chkFreeze])
        this.child([this.label, this.container]);

        this.updateLayout();
    }

    updateSliderLabel(val)
    {
        let valstr = this.parameter.type == 'integer' ? Math.floor(val) : nf(val,0,this.sliderValue.floatPrecision);
        this.label.text(`${this.name}&nbsp;&nbsp;<span class="slider-label-value">${valstr}</span>`);
    }

    updateLayout()
    {
        let val = this.parameter['obj'][this.name];
        this.sliderValue.val( val );
        this.updateSliderLabel( val );
        super.updateLayout();
    }

    enable(is=true)
    {
        this.sliderValue.enable(is);
        this.label.elmt().style.opacity = is ? 1.0 : 0.5;
        return this;
    }   
}