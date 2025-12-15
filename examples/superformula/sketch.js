// Prefix for the session id (for multiple projects)
const USER_SKETCH_ID = 'superformula';

const DIM_ARTWORK_MM = {width:2000, height:2000};
var M, N1, N2, N3, BASE_R, LAYERS, ROTSTEP, NOISE_AMP_X, NOISE_AMP_Y, NOISE_FREQ_X, NOISE_FREQ_Y;
var p5RandomSeed;

let paramExplorer;

async function setup() 
{
  console.log("globalThis=", globalThis);
  noLoop();
  createCanvas(DIM_ARTWORK_MM.width, DIM_ARTWORK_MM.height);

  setupArtwork();
  
  // Param explorer
  paramExplorer = (new ParamExplorer(USER_SKETCH_ID)).setParameters(
  {
    'M' : {'type' : 'float', 'range' : [0,20]},
    'N1' : {'type' : 'float', 'range' : [0.001,20]},
    'N2' : {'type' : 'float', 'range' : [0.001,20]},
    'N3' : {'type' : 'float', 'range' : [0.001,20]},
    'BASE_R' : {'type' : 'float', 'range' : [350,800]},
    'LAYERS' : {'type' : 'integer', 'range' : [1,40]},
    'ROTSTEP' : {'type' : 'float', 'range' : [-0.04,0.04]},
  }).finalize();

  await paramExplorer.update();

  await createUI(paramExplorer, {
      'viewCanvas'  : {
      canvasWidth  : width,
      canvasHeight : height,
      canvasBackgroundColorDefault : "#FFF"
    }
  });
}

function setupArtwork(newSeed=false)
{
  if (!p5RandomSeed || newSeed)
    p5RandomSeed = int(random(100000));
  randomSeed(p5RandomSeed);

  return globalThis;
}

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


  sketch.push();
  sketch.translate(sketch.width / 2, sketch.height / 2);
  sketch.noFill();
  sketch.colorMode(HSB, 255);
  sketch.strokeWeight(SW);

  for (let i = 0; i < LAYERS; i++) {
    const rot = i * ROTSTEP;
    sketch.stroke(255);
    sketch.push();
    sketch.rotate(rot);
    sketch.beginShape();
    for (let k = 0; k <= POINTS; k++) {
      const phi = map(k, 0, POINTS, 0, TWO_PI);
      let r = superR(phi) * BASE_R;

      let x = r * cos(phi);
      let y = r * sin(phi);

      let nx = sketch.noise(
        x * NOISE_FREQ_X,
        y * NOISE_FREQ_X,
      );

      let ny = sketch.noise(
        x * NOISE_FREQ_Y + 100,
        y * NOISE_FREQ_Y + 100,
      );

      nx = (nx - 0.5) * 2.0;
      ny = (ny - 0.5) * 2.0;

      const xd = x + nx * NOISE_AMP_X;
      const yd = y + ny * NOISE_AMP_Y;

      sketch.vertex(xd, yd);

    }
    sketch.endShape(CLOSE);
    sketch.pop();
  }

  sketch.colorMode(RGB, 255);
  sketch.pop();

  console.groupEnd();
}