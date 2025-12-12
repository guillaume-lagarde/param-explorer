class UITab extends UIElement
{
    constructor(opts={})
    {
        super("div");
        this.class("ui container tab");
        this.btns=new Map();
        this.idCurrent = null;
        this.bFlex = true;
    }

    add(id, label, cbClick)
    {
        let btnTab = UI.button().text(label).id(`btn-${id}`);
        btnTab.click( _ => this.select(id) );
        btnTab.cbClick = cbClick;
        this.child(btnTab);
        this.btns.set(id, btnTab);
    }

    select(id)
    {
        if (id != this.idCurrent && this.btns.has(id))
        {
            this.btns.forEach( btn => btn.removeClass("selected") )

            let btnTab = this.btns.get(id);
            btnTab.addClass("selected");
            this.idCurrent = id;            
            btnTab.cbClick(id);
        }
    }

    val(id)
    {
        if (id === undefined)
        {
            return this.idCurrent;
        }
        else
        {
            //this.select(id)
            if (id != this.idCurrent && this.btns.has(id))
            {
                this.btns.forEach( btn => btn.removeClass("selected") )
                let btnTab = this.btns.get(id);
                btnTab.addClass("selected");
                this.idCurrent = id;            
            }
        }
    }
}