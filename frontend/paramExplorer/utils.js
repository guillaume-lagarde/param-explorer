// ----------------------------------------------------
function isFunction(f)
{
    return typeof f === "function";
}

// ----------------------------------------------------
function isNumber(value) 
{
    return typeof value === 'number' && !isNaN(value);
}

// ----------------------------------------------------
function formatTimestamp(ts)
{
    return new Date(ts).toLocaleString();
}
  
// ----------------------------------------------------
function shortenString(str, startLength, endLength)
{
    if (str.length <= startLength + endLength) 
        return str; // No need to shorten
    return str.substring(0, startLength) + '[...]' + str.substring(str.length - endLength);
}



// ----------------------------------------------------
function createSketch(sketch,w,h,parentId,id)
{
  let c = sketch
  .createCanvas(w,h)
  .parent(parentId)
  .id(id);
  sketch.noLoop();
  sketch.angleMode(RADIANS);

  c.removeAttribute('style');

  return c;
}

