class UIViewCanvas extends UIElement
{
    constructor(id,opts={})
    {
        super('div', opts);
        this.id(id).addClass('view');
        this.bFlex          = true;

        this.sketch         = null;

        this.canvas         = null;
        this.canvasWidth    = opts.canvasWidth??500;
        this.canvasHeight   = opts.canvasHeight??500;
    }

    create()
    {
        this.container      = UI.div().addClass(['ui','container-bg','user']); 
        this.child(this.container);
    }

    drawSketchTextCentered(sketch, strWait, strColor="#000")
    {
        sketch.push();
        sketch.stroke(strColor);
        sketch.textSize(20);
        let wStr = sketch.textWidth(strWait);
        sketch.text(strWait, (sketch.width-wStr)/2, sketch.height/2);
        sketch.pop();
    }


}