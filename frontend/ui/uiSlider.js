class UISlider extends UIElement
{
    static FLOAT    = 0;
    static INT      = 1;

    constructor(opts={})
    {
        super("div", {"class":"range-container"});

        this.bDisplayLabelValue     = true;
        this.floatPrecision         = 2;
        this.setType(UISlider.FLOAT);

        this.lbl                    = UI.label().text( opts.label || "" );
        this.label                  = this.lbl.elmt().innerHTML; 
        this.inputRange             = UI.input("range").class("slider").attr(opts);
        this.lblMin                 = UI.div().class("lbl-slider-min");
        this.lblMax                 = UI.div().class("lbl-slider-max");

        if (opts.min !== undefined)
        {
            this.lblMin.text(`${+(opts.min).toFixed(2)??"?"}`);            
            this.min = +(opts.min);
        }

        if (opts.max !== undefined)
        {
            this.lblMax.text(`${+(opts.max).toFixed(2)??"?"}`);            
            this.max            = +(opts.max);
        }
    

        this.hideName       = opts.hideName != undefined ? opts.hideName : false;
        if (this.hideName)
            this.lbl.hide();

        this
        .child( this.lbl )
        .child
        (
            UI.div().class("control flex slider-bar")
                .child( this.lblMin  )
                .child( this.inputRange )
                .child( this.lblMax )
        );
       
        this.addEventListener("input", value=>
        {
            this.updateLabelValue( +(value) );
        });

        //this.updateLabelValue( value );
    }

    setType(type)
    {
        this.type = type;
        return this;
    }

    noDisplayLabelValue()
    {
        this.bDisplayLabelValue = false;
        return this;

    }

    displayColumns()
    {
        this.addClass("columns");
        return this;
    }

    change(cb)
    {
        this.addEventListener("change", e => cb.call(null, this.val()/*this.inputRange.elmt().value*/ ));
        return this;
    }

    removeEventListener(eventName, cb)
    {
        this.inputRange.elmt().removeEventListener(eventName, cb);
        return this;
    }


    addEventListener(eventName, cb)
    {
        this.inputRange.elmt().addEventListener(eventName, e=> cb.call(null, this.val()/*this.inputRange.elmt().value*/ ) );
        return this;
    }

   step(s)
   {
        this.inputRange.attr( {"step" : s} );
        return this;
   }

    setLabel(s)
    {
        this.label = s;
        //this.lbl.text(s);
        return this;
    }

   setFloatPrecision(fp)
   {
        this.floatPrecision = fp;
        return this;
   }
    
   updateLabelValue(value)
   {
        if (this.lbl && this.bDisplayLabelValue)
        {
            let v = this.type == UISlider.FLOAT ?  value.toFixed(this.floatPrecision) : value;
            if (this.hideName)
            {
                this.lbl.hide();
            }
            else
            {
                let strVal = `<span class="slider-label-value">${v}</span>`;
                this.lbl.text( this.label != "" ? (this.label + "&nbsp" + strVal) : strVal );
            }

        }
    }
    

    val(v)
    {
        if (v !== undefined)
        {
            if (this.type == UISlider.INT) v = parseInt(v);
            this.inputRange.elmt().value = v;
            this.updateLabelValue(v);
        }
        else 
        {
            let val = this.inputRange.elmt().value;
            if (this.type == UISlider.INT) 
                val = parseInt(val);

            return val;
        }
    }
    
    enable(is=true)
    {
        this.lbl.elmt().style.opacity = is ? 1.0 : 0.5;
        this.lblMin.elmt().style.opacity = is ? 1.0 : 0.5;
        this.lblMax.elmt().style.opacity = is ? 1.0 : 0.5;

        this.inputRange.elmt().disabled = !is;
        return this;
    }    
}