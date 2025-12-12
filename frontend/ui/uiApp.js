// --------------------------------------------------------
const __UI_LOG__                    = false;
const __UI_VIEW_GALLERY_CLUSTER__   = false;
let   __UI_PARAM_EXPLORER__         = null;
// --------------------------------------------------------
let ui, uiProject, uiTabViews, uiViewExploreBatch, uiViewExploreManual, uiViewGallery, uiViewGalleryImage, uiViewGalleryCluster;
let mapViews;
let viewCurrent, viewCurrentId;

// --------------------------------------------------------
async function createUI(pe, opts={})
{
  __UI_PARAM_EXPLORER__ = pe; // used in UI

  uiProject           = new UIProject();
  uiProject.create();
  document.body.prepend( uiProject.elmt() );

  // Create views
  uiViewExploreManual = new UIViewExploreManual(pe, opts.viewCanvas??{});
  uiViewExploreBatch  = new UIViewExploreBatch(pe, opts.viewCanvas??{});
  uiViewGallery       = new UIViewGallery(opts.viewGallery??{});
  uiViewGalleryImage  = new UIViewGalleryImage();
  if (__UI_VIEW_GALLERY_CLUSTER__)
    uiViewGalleryCluster= new UIViewGalleryCluster();

  // Tab
  uiTabViews = new UITab();
  uiTabViews.id("tab-views");

  uiTabViews.add("manual",       "Manual exploration",         setView);
  uiTabViews.add("batch",        "Agent exploration",          setView);
  uiTabViews.add("gallery",      "Gallery",                    setView);
  if (__UI_VIEW_GALLERY_CLUSTER__)
    uiTabViews.add("clusters",     "Clusters",                   setView);

  mapViews=new Map();
  mapViews.set('manual',        uiViewExploreManual);
  mapViews.set('batch',         uiViewExploreBatch);
  mapViews.set('gallery',       uiViewGallery);
  if (__UI_VIEW_GALLERY_CLUSTER__)
    mapViews.set('clusters',      uiViewGalleryCluster);

  mapViews.forEach( view =>
  {
    document.body.prepend( view.elmt() );
    view.create();
  })

  await uiViewGallery.load();

  if (__UI_VIEW_GALLERY_CLUSTER__)
    await uiViewGalleryCluster.load();

  // Attach elements to DOM
  document.body.append( uiTabViews.elmt() );

  // Gallery image
  uiViewGalleryImage.create();

  // Default view
  setView(opts.viewDefault??'batch');

  if (__UI_LOG__)
    console.log(`Setting view to '${opts.viewDefault}'`);
}

// --------------------------------------------------------
function createUITextEditScore(id='teScore', cbScoreValidated)
{
    let teScore = new UITextInput({'label':'Score'});
    teScore.bFlex = true;
    teScore.id(id).addClass('teScore').change( async e => 
    {
        let score = int( teScore.val() );
        if (score >= 0 && score <= 100)
        {
          if (isFunction(cbScoreValidated)) cbScoreValidated(score);
        }
        else
        {
            console.warn('Invalid score');
            //this.teScore.val('');
        }
    });
    return teScore;
}

// --------------------------------------------------------
function setView(id)
{
  mapViews.forEach( view => view.hide() );
  let view = mapViews.get(id);
  if (view)
  {
    view.show();        
    uiTabViews.select(id);

    viewCurrent = view;
    viewCurrentId = id;
  }
}

// --------------------------------------------------------
function isView(id)
{
  return (viewCurrentId == id);
}

// --------------------------------------------------------
async function uiEditImageManual(session_id, image_id)
{
  let result = await call('load_image_data', {'session_id':session_id, 'image_id':image_id});
  if (result.status == 'ok')
  {
    uiViewExploreManual.viewArtworkWithParameters(result.imageInfos.parameters, result.imageInfos.metadata);
    setView('manual');
  }
}

// --------------------------------------------------------
function uiResize()
{
  mapViews.forEach( view=>{
    if (isFunction(view.resize)) 
      view.resize();
  })
}

window.addEventListener('resize', uiResize);