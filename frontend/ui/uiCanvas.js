class UICanvas extends UIElement
{
    constructor(opts={})
    {
        super("div", {"class":"canvas-container"});
    }

    setCanvas(canvas, opts={'remove':true})
    {
        if (this.canvasChild && opts.remove)
            this.element.removeChild(this.canvasChild);
        this.canvasChild = this.element.appendChild(canvas);        
        return this;
    }

    create(w,h)
    {
        if (this.pg)
            this.pg.remove();
        this.pg  = createGraphics(w,h);  
        this.setCanvas(this.pg.canvas);
        this.pg.show();
    }

    static adjustStyle(canvas)
    {
        let c = canvas.elt??canvas;
        c.style.width      = '100%';  
        c.style.height     = 'auto';  
    }
}

class UICanvasVector extends UICanvas
{
    constructor(opts={'centered':false})
    {
        super(opts);
        this.set(opts);
        this.bMouseDown = false;
        this.changedCbs = [];
    }

    set(opts={})
    {
        this.name       = opts.name??"vector";
        this.bCentered  = opts.centered ?? false;
        this.pos        = this.bCentered ? createVector(0,0) : createVector(0.5,0.5);
        return this;
    }

    val(v)
    {
        if (v!==undefined)
        {
            // console.log(v)
            this.pos.set(v);
            this.updateCanvas();
        }
        else 
            return this.pos;    
    }

    change(cb)
    {
        this.changed(cb);
    }

    changed(cb)
    {
        this.changedCbs.push(cb);
    }

    create(w,h)
    {
        // Label
        this.lbl            = UI.label().text( this.name );
        this.child(this.lbl);

        // Canvas
        super.create(w,h);

        // Mouse events
        this.pg.canvas.addEventListener("mousedown", e=>
        {
            this.updatePosFromMouse(e);
            this.updateCanvas();
            this.bMouseDown = true;
        });

        this.pg.canvas.addEventListener("mousemove", e=>
        {
            if (this.bMouseDown)
            {
                this.updatePosFromMouse(e);
                this.updateCanvas();
            }
        });

        this.pg.canvas.addEventListener("mouseup", e=>{
            this.bMouseDown = false;

            // Call cbs
            this.changedCbs.forEach( cb => 
                {
                    cb.call(null,this.pos);
                })        
        });

        this.updateCanvas();
    }

    updatePosFromMouse(e)
    {
        let xn = e.offsetX/this.pg.width;
        let yn = e.offsetY/this.pg.height;
        if (this.bCentered)
            this.pos.set(xn-0.5,yn-0.5);
        else
            this.pos.set(xn,yn);
    }

    updateCanvas()
    {
        let x = (this.pos.x+(this.bCentered ? 0.5 : 0)) * this.pg.width;
        let y = (this.pos.y+(this.bCentered ? 0.5 : 0)) * this.pg.height;

        // Draw
        this.pg.background(0);
        this.pg.stroke(255);
        this.pg.line(x,0,x,this.pg.height);
        this.pg.line(0,y,this.pg.width,y);
        
        // Label
        this.lbl.text(`${this.name} - [${this.pos.x.toFixed(2)},${this.pos.y.toFixed(2)}]`);

    }
}