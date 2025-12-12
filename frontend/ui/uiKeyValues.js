class UIKeyValues extends UIElement
{
    constructor()
    {
        super("div");
        this.class("container");
        this.mapKeyValues = new Map();
    }

    size()
    {
        return this.mapKeyValues.size;
    }

    setVal(key,value)
    {
        let kv = this.mapKeyValues.get(key);
        if (!kv)
            kv = this.add(key,value);    
        kv.lblVal.text(value);
    }

    add(key,value)
    {
        let divKV = UI.div().class("container key-value");
        divKV.lblKey = UI.label().class("key").text(key);
        divKV.lblVal = UI.label().class("value").text(value);

        divKV.child([divKV.lblKey,divKV.lblVal]);

        this.mapKeyValues.set(key, divKV);

        this.child(divKV);
        return divKV;
    }
}