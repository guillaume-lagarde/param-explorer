class UIElement
{
    constructor(type, opts={})
    {
        this.element = document.createElement(type);
        this.set(opts);
        if (opts.id) this.name = opts.id;
        this.children = [];
        this.bFlex = false;
    }

    elmt()
    {
        return this.element;
    }
    
    clear()
    {
        while (this.element.firstChild) {
            this.element.removeChild(this.element.firstChild);
          }        
    }

    set(opts={})
    {
        if (opts.id)        this.id(opts.id)
        if (opts.class)     this.class(opts.class);
        if (opts.attr)      this.setAttributes(opts.attr);
    }    

    hide()
    {
        this.element.style.display = "none";
        return this;
    }

    show()
    {
        this.element.style.display = this.bFlex ? "flex" : "block";
        return this;
    }

    isVisible()
    {
        return this.element.style.display == "flex" || this.element.style.display == "block";
    }
    
    setAttribute(key,value)
    {
        this.element.setAttribute(key,value);
        return this;
    }

    attr(attr={})
    {
        return this.setAttributes(attr);
    }

    setAttributes( attr={})
    {
        for (const [key,value] of Object.entries(attr))
            this.setAttribute(key,value);
        return this;
    }

    id(id)
    {
        if (id===undefined)
            return this.elmt().getAttribute("id");
        return this.setAttribute("id",id);
    }    

    addClass(class_)
    {
        if (Array.isArray(class_))
            class_.forEach( c=>this.addClass(c) );
        else
            this.elmt().classList.add(class_);
        return this;
    }

    removeClass(class_)
    {
        this.elmt().classList.remove(class_);
        return this;
    }

    class(class_)
    {
        return this.setAttribute("class",class_);
    }  

    text(s)
    {
        this.element.innerHTML = s;
        return this;
    }

    child(elmt,opts={})
    {
        if (opts.log)
            console.log(`UIElement.child()`, elmt);
        if (elmt)
        {
            if (Array.isArray(elmt))
                elmt.forEach( e => this.child(e) );
            else
            {
                if (elmt)
                    this.appendChild(elmt);
            }
        }
        return this;
    }
    
    appendChild(elmt,opts={})
    {
        if (opts.log)
            console.log(`UIElement.appenChild()`, elmt);
        if (elmt)
        {
            this.element.appendChild(elmt.elmt());
            this.children.push(elmt);            
        }
        return this;
    }

    // https://www.w3schools.com/jsref/met_node_insertadjacentelement.asp
    insertAdjacentElement(elmt,where)
    {
        if (elmt)
            this.element.insertAdjacentElement(where, elmt.elmt());
        return this;
    }

    enable(is=true){this.children.forEach( elmt=>elmt.enable(is) )}
    disable(){this.enable(false)}
}