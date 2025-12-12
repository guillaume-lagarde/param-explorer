// Unique ID for your sketch
// This will help paramExplorer save some variables on client side (localStorage)
const USER_SKETCH_ID = 'my_project';

// Param explorer instance
let paramExplorer;

// User variables
let p5RandomSeed;

// --------------------------------------------------------
// Just used as an entry point
async function setup() 
{
  // P5 stuff : no canvas, no loop
  noLoop();
  noCanvas();

  // Create dummy artwork so the param explorer can address properties
  setupArtwork();
  
  // Param explorer
  paramExplorer = (new ParamExplorer(USER_SKETCH_ID)).setParameters(
  {
    // TODO : link your parameters here
    
  }).finalize();

  // Update it
  await paramExplorer.update();

  // UI
  await createUI(paramExplorer);
}

// --------------------------------------------------------
// Called by paramExplorer before calling drawArtwork()
// The function is called with newSeed set to true when : 
// - Manual / you click on the 'generate‘ button
// - Batch / you click on the 'run batch' button
function setupArtwork(newSeed=false)
{
  // Generate a random seed (what would user do)
  if (!p5RandomSeed || newSeed)
    p5RandomSeed = int(random(100000));
  randomSeed(p5RandomSeed);

  // Return it
  return globalThis;
}

// --------------------------------------------------------
// Draws artwork for sketch (either from manual or batch)
// params were set before call 
function drawArtwork(sketch)
{
}

// --------------------------------------------------------
// Called when saving informations about the sketch
// For example : it is common to save the seed that
// allowed the generation of the drawing
function getArtworkData()
{
  return {'p5RandomSeed' : p5RandomSeed};
}

// --------------------------------------------------------
function setArtworkData(data)
{
  if (data['p5RandomSeed'])
  {
    p5RandomSeed = data['p5RandomSeed'];
  }
  else 
  {
    console.warn('no "p5RandomSeed" found in data');
  }
}