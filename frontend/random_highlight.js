
/**
 * Highlight Generative Art Utilities Script : V0
 * @version: 0.0.1
 * @description The script exposes additional utilities.
 */
function xmur3(str) 
{
    for (var i = 0, h = 1779033703 ^ str.length; i < str.length; i++)
        (h = Math.imul(h ^ str.charCodeAt(i), 3432918353)),
        (h = (h << 13) | (h >>> 19));
    return function () {
        (h = Math.imul(h ^ (h >>> 16), 2246822507)),
        (h = Math.imul(h ^ (h >>> 13), 3266489909));
        return (h ^= h >>> 16) >>> 0;
    };
}

function sfc32(a, b, c, d) 
{
    return function () {
        a |= 0;
        b |= 0;
        c |= 0;
        d |= 0;
        var t = (((a + b) | 0) + d) | 0;
        d = (d + 1) | 0;
        a = b ^ (b >>> 9);
        b = (c + (c << 3)) | 0;
        c = (c << 21) | (c >>> 11);
        c = (c + t) | 0;
        return (t >>> 0) / 4294967296;
    };
}

function createRandomNumberGenerator(seed) 
{
    const xmur3Value = xmur3(seed);
    return sfc32(xmur3Value(), xmur3Value(), xmur3Value(), xmur3Value());
}

class RandomHighlight
{
  // --------------------------------
    constructor(seed) 
    {
      this.seed = seed??RandomHighlight.generateRandomHash();
      this.randomFunc = createRandomNumberGenerator(this.seed);
    }
    
    // --------------------------------
    // random number between 0 (inclusive) and 1 (exclusive)
    random_dec() 
    {
      return this.randomFunc();
    }

    // --------------------------------
    // random number between a (inclusive) and b (exclusive)
    random_num(a, b) 
    {
      return a + (b - a) * this.random_dec();
    }

    // --------------------------------
    random_between(a, b) {return this.random_num(a,b);}
    
    // --------------------------------
    // random integer between a (inclusive) and b (inclusive)
    // requires a < b for proper probability distribution
    random_int(a, b) {
      return Math.floor(this.random_num(a, b + 1));
    }


    // --------------------------------
    // random boolean with p as percent liklihood of true
    random_bool(p) 
    {
      return this.random_dec() < p;
    }

    // --------------------------------
    // random value in an array of items
    random_choice(list) {
      return list[this.random_int(0, list.length - 1)];
    }

    // --------------------------------
    // random key from map
    random_key_map(map) 
    {
      return this.random_choice( Array.from(map.keys()) );
    }
    
    // --------------------------------
    // random value from map
    random_value_map(map) 
    {
      return this.random_choice( Array.from(map.values()) );
    }


    // --------------------------------
    random_shuffle(arr)
    {
      const copy = [...arr] // create a copy of original array
      for (let i = copy.length - 1; i; i --) {
        const randomIndex = this.random_int(0,i);
        [copy[i], copy[randomIndex]] = [copy[randomIndex], copy[i]] // swap
      }
      return copy;
    }

    // --------------------------------
    // from https://observablehq.com/@makio135/utilities
    random_weighted(items, weights)
    {

      const cumulativeWeights = [];
      for (let i = 0; i < weights.length; i += 1) {
        cumulativeWeights[i] = weights[i] + (cumulativeWeights[i - 1] || 0);
      }

      const maxCumulativeWeight = cumulativeWeights[cumulativeWeights.length - 1];
      const randomNumber = maxCumulativeWeight * this.random_dec();

      for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
        if (cumulativeWeights[itemIndex] >= randomNumber) {
          return {
            item: items[itemIndex],
            index: itemIndex,
          };
        }
      }

    }

    // --------------------------------
    // taken from hl-gen.js
    static generateRandomHash()
    {
      const alphabet = "0123456789abcdef";
      return (
        "0x" +
        Array(64)
          .fill(0)
          .map((_) => alphabet[(Math.random() * alphabet.length) | 0])
          .join("")
      );
    }    
}

