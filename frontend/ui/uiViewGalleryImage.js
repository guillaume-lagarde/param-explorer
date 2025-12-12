class UIViewGalleryImage extends UIElement
{
    // ----------------------------------------------------
    constructor(opts={})
    {
        super("div", opts);
        this.id('view-gallery-image').addClass('view');

        this.bFlex = true;
        this._onKeyDown = this._onKeyDown.bind(this);
        this._onClick   = this._onClick.bind(this);
    }

    // ----------------------------------------------------
    setImage(src)
    {
        this.elmt().innerHTML = `<img src="${src}" />`;
    }

    // ----------------------------------------------------
    show(url)
    {
        document.addEventListener('keydown', this._onKeyDown);
        this.elmt().addEventListener('click', this._onClick, false);
        this.addClass('show');
        if (url) this.setImage(url);
        super.show();
    }

    // ----------------------------------------------------
    hide()
    {
        document.removeEventListener('keydown', this._onKeyDown);
        this.elmt().removeEventListener('click', this._onClick);
        this.removeClass('show');
        this.elmt().innerHTML = '';
        super.hide();
    }

    // ----------------------------------------------------
    create()
    {
        document.body.append( this.elmt() );        
        this.hide();
    }

    // ----------------------------------------------------
    _onKeyDown(e)
    {
        e.preventDefault();
        if (e.code == 'Escape') this.hide();
    }

    // ----------------------------------------------------
    _onClick(e)
    {
        this.hide();
    }

}
