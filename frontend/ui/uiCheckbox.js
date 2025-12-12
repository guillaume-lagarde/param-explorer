class UICheckbox extends UIElement
{
    static id_switch = 0;

    constructor(opts={})
    {
        super("div", opts);
        this.class("checkbox-container");

        this.lbl            = UI.label().text( opts.label || "???" );
        let chk_control     = UI.div().class("checkbox-control");

        let chk_input_id    = `chk-${UICheckbox.id_switch}`; 
        this.chk_input      = UI.input("checkbox").id(chk_input_id);
        this.chk_lbl        = UI.label({"attr" : {"for" : chk_input_id} });

        this
        .child( this.lbl )
        .child( chk_control.child(this.chk_input).child(this.chk_lbl) );

        this.bEnabled = true;

        UICheckbox.id_switch++;
    }

    label(s)
    {
        this.lbl.text(s);
        return this;
    }

    val(v)
    {
        let elmt = this.chk_input.elmt();
        if (arguments.length == 0)
            return elmt.checked;        
        else
        {
          elmt.checked = v;
        }
        return this;
    }

    enable(is)
    {
        this.lbl.elmt().style.opacity = is ? 1.0 : 0.5;
        if (is)
        {
            this.chk_input.elmt().disabled = false;
            this.chk_lbl.removeClass('disabled');
        }
        else
        {
            this.chk_input.elmt().disabled = true;
            this.chk_lbl.addClass('disabled');
        }
        this.bEnabled = is;
    }


    change( cb )
    {
        this.chk_input.elmt().addEventListener("change", e=> { if (this.bEnabled) cb.call(null, this.val() ) } );
        return this;
    }

}
// CSS : https://alvarotrigo.com/blog/toggle-switch-css/

/*

    <div class="checkbox-container">
      <label>Test</label>
      <div class="checkbox-control">
        <input type="checkbox" id="switch">
        <label for="switch"></label>      
      </div>
    </div>


*/