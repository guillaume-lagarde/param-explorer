// Prefix for the session id (for multiple projects)
const USER_SKETCH_ID = 'superformula';

const DIM_ARTWORK_MM = {width:2000, height:2000};
// User algorithm / params
// Create into initArtwork()
var M, N1, N2, N3, BASE_R, LAYERS, ROTSTEP, NOISE_AMP_X, NOISE_AMP_Y, NOISE_FREQ_X, NOISE_FREQ_Y;
var p5RandomSeed;

// Our tool
let paramExplorer;

// --------------------------------------------------------
// User func
// Just used as an entry point
async function setup() 
{
  console.log("globalThis=", globalThis);
  // P5 stuff : no canvas, no loop
  noLoop();
  // noCanvas();
  createCanvas(DIM_ARTWORK_MM.width, DIM_ARTWORK_MM.height);

  // Create dummy artwork so the param explorer can address properties
  setupArtwork();
  
  // Param explorer
  paramExplorer = (new ParamExplorer(USER_SKETCH_ID)).setParameters(
  {
    // TODO : link your parameters here
    'M' : {'type' : 'float', 'range' : [0,20]},
    'N1' : {'type' : 'float', 'range' : [0.001,20]},
    'N2' : {'type' : 'float', 'range' : [0.001,20]},
    'N3' : {'type' : 'float', 'range' : [0.001,20]},
    'BASE_R' : {'type' : 'float', 'range' : [350,800]},
    'LAYERS' : {'type' : 'integer', 'range' : [1,40]},
    'ROTSTEP' : {'type' : 'float', 'range' : [-0.04,0.04]},
    // 'NOISE_AMP_X'  : { 'type': 'float', 'range': [0, 100] },
    // 'NOISE_AMP_Y'  : { 'type': 'float', 'range': [0, 100] },
    // 'NOISE_FREQ_X' : { 'type': 'float', 'range': [0, 0.03]},
    // 'NOISE_FREQ_Y' : { 'type': 'float', 'range': [0, 0.03] },
  }).finalize();

  // Update it
  await paramExplorer.update();

  // UI
  await createUI(paramExplorer, {
      'viewCanvas'  : {
      canvasWidth  : width,
      canvasHeight : height,
      canvasBackgroundColorDefault : "#FFF"
    }
  });
}

// --------------------------------------------------------
// User func
// Should return the instance
function setupArtwork(newSeed=false)
{
  // Generate a random seed (what would user do)
  if (!p5RandomSeed || newSeed)
    p5RandomSeed = int(random(100000));
  randomSeed(p5RandomSeed);

  return globalThis;
}

// --------------------------------------------------------
// Called when saving data to server
// Important : user may want to save for example the seed 
// used for his random functions 
function getArtworkData()
{
  return {'p5RandomSeed' : p5RandomSeed};
}

// --------------------------------------------------------
function setArtworkData(data)
{
  console.group('setArtworkData()');
  console.log('data', data);
  if (data['p5RandomSeed'])
  {
    p5RandomSeed = data['p5RandomSeed'];
  }
  else 
  {
    console.warn('no "p5RandomSeed" found in data');
  }
  console.groupEnd();
}

// --------------------------------------------------------
// User func
// Draws artwork for sketch (manual / batch)
// params were set before call 
function drawArtwork(sketch)
{
  sketch.background(20);
  console.group('drawArtwork()');

  const SW = 1;
  const POINTS = 2000;
  const NOISE_AMP_X = 0;
  const NOISE_AMP_Y = 0;
  const NOISE_FREQ_X = 0;
  const NOISE_FREQ_Y = 0;

  // Superformula radius
  // r(φ) = [ (|cos(m φ / 4)|^(n2)/a^(n2) + |sin(m φ / 4)|^(n3)/b^(n3)) ]^(-1/n1)
  // avec a=b=1
  const superR = (phi) => {
    const t = M * phi * 0.25;
    const part1 = pow(abs(cos(t)), N2);
    const part2 = pow(abs(sin(t)), N3);
    const denom = pow(part1 + part2, 1.0 / N1);
    const r = (denom === 0) ? 0 : 1.0 / denom;
    return r;
  };
  console.log(M,N1,N2,N3,BASE_R,LAYERS,ROTSTEP, NOISE_AMP_X, NOISE_AMP_Y, NOISE_FREQ_X, NOISE_FREQ_Y);

  // bruit radial doux (0-centred)
  // const radialNoise = (phi, layerIndex) => {
  //   // échantillonnage 2D du bruit en coordonnées polaires -> cartésiennes
  //   const x = cos(phi) * NOISE_FREQ + layerIndex * 0.013;
  //   const y = sin(phi) * NOISE_FREQ + layerIndex * 0.017;
  //   return (noise(x, y) - 0.5) * 2.0; // [-1, 1]
  // };

const radialNoise = (phi, layerIndex) => {
  // 1D Perlin noise along the angle, offset by layer
  const n = noise(phi * NOISE_FREQ, layerIndex * 0.2);
  return (n - 0.5) * 2.0; // map [0,1] -> [-1,1]
};


  sketch.push();
  sketch.translate(sketch.width / 2, sketch.height / 2);
  sketch.noFill();
  sketch.colorMode(HSB, 255);
  sketch.strokeWeight(SW);

  // Dessin de LAYERS courbes superposées, légèrement tournées et bruitées
  for (let i = 0; i < LAYERS; i++) {
    const rot = i * ROTSTEP;
    // const hue = (COLOR_H + i * 1.3) % 255; // dérive lente de la teinte
    // sketch.stroke(hue, 180, 255, 110);
    sketch.stroke(255);
    sketch.push();
    sketch.rotate(rot);
    sketch.beginShape();
    // résolution angulaire
    for (let k = 0; k <= POINTS; k++) {
      const phi = map(k, 0, POINTS, 0, TWO_PI);
      // rayon superformula (normalisé) * rayon de base
      // 1. Compute pure superformula point
      let r = superR(phi) * BASE_R;

      let x = r * cos(phi);
      let y = r * sin(phi);

      // 2. Compute Perlin noise at (x, y)
      let nx = sketch.noise(
        x * NOISE_FREQ_X,
        y * NOISE_FREQ_X,
      );

      let ny = sketch.noise(
        x * NOISE_FREQ_Y + 100,   // offset so x and y noises differ
        y * NOISE_FREQ_Y + 100,
      );

      // 3. Center noise → [-1, 1]
      nx = (nx - 0.5) * 2.0;
      ny = (ny - 0.5) * 2.0;

      // 4. Apply displacement
      const xd = x + nx * NOISE_AMP_X;
      const yd = y + ny * NOISE_AMP_Y;

      // 5. Write vertex
      sketch.vertex(xd, yd);

    }
    sketch.endShape(CLOSE);
    sketch.pop();
  }

  // reset color mode (pas indispensable si tout est géré ici)
  sketch.colorMode(RGB, 255);
  sketch.pop();

  console.groupEnd();
}