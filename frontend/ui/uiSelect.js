class UISelect extends UIElement
{
    constructor(opts={})
    {
        super("div", opts);

        this.lbl            = UI.label().text( opts.label || "???" );
        this.select         = UI.select_();

        this
        .class("select-control")
        
        if (opts['noLabel'] == undefined)
        {
            this.child( this.lbl );
        }
        else
        {
            this.select.elmt().style.marginLeft = '0px';
        }
        
        this.child
        (
            this.select
        );
    }

    clear()
    {
        while(this.select.elmt().lastChild)
            this.select.elmt().removeChild(this.select.elmt().lastChild);
        return this;
    }

    addFromArray(arr,opts={'indexAsKeys':true})
    {
        let m = new Map();
        if (opts.indexAsKeys)   
            arr.forEach( (v,index) =>  m.set(index,v))
        else
            arr.forEach( v =>  m.set(v,v)); // exemple : array of strings
        
        this.add(m);
        return this;
    }

    // Assume key is a string
    add(map,opts={})
    {
        let m = map;
        if (opts.fromKeys === true)
        {
            m = new Map();
            map.forEach(  (v,k) => m.set(k,k) );
        }
        if(opts.sortByKeys === true)
            m = mapSortByKeys(m);

        m.forEach( (lbl,key) => this.addOption(key,lbl) );
        return this;
    }

    addOption(label,value)
    {
        let option = document.createElement("option");
        option.setAttribute("value", value);
        option.innerHTML = label;
        this.select.elmt().appendChild( option );
        return this;
    }

    change( cb )
    {
        // this.select.elmt().addEventListener("change", cb);
        this.select.elmt().addEventListener("click", e=>e.stopPropagation());
        this.select.elmt().addEventListener("change", e => {cb.call(null,this.val())});
        return this;
    }

    val(v)
    {
        let elmt = this.select.elmt();
        if (arguments.length == 0)
            return elmt.options[elmt.selectedIndex].value;        
        else
        {
            elmt.value = v; 
        }
        return this;
    }

    bindToParameter(param)
    {
    }

    disable()
    {
        return this.enable(false);
    }

    enable(is=true)
    {
        if (is)
        {
            this.lbl.elmt().style.opacity = 1.0;
            this.select.elmt().disabled = false;
        }
        else 
        {
            this.lbl.elmt().style.opacity = 0.5;
            this.select.elmt().disabled = true;
        }
        return this;
    }

}
