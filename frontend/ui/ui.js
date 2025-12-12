class UI
{
    static(){}
    constructor(){}

    static element(type, opts={})   { return new UIElement(type,    opts) }
    static p(opts={})               { return UI.element("p",        opts) }
    static span(opts={})            { return UI.element("span",     opts) }
    static div(opts={})             { return UI.element("div",      opts) }
    static label(opts={})           { return UI.element("label",    opts) }
    static h1(opts={})              { return UI.element("h1",       opts) }
    static h2(opts={})              { return UI.element("h2",       opts) }
    static h3(opts={})              { return UI.element("h3",       opts) }
    static select_(opts={})         { return UI.element("select",   opts) }
    static textInput(opts={})       { return new UITextInput(opts)        }
    static button(opts={})          { return new UIButton(opts)           }
    static colorPicker(opts={})     { return UI.input("color", opts)      }
    
    static input(type, opts={})     
    {
        return UI.element("input", opts).setAttribute("type", type);
    }  
    
    static slider(opts={})          
    {
        return new UISlider(opts);
    }

    static checkbox(opts={})          
    {
        return new UICheckbox(opts);
    }

    static select(opts={})
    { 
        return new UISelect(opts) 
    }

    static title(s)
    {
        return UI.label().class("underline").text(s);
    }


}