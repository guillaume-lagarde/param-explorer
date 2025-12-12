
const PARAMETER_SAMPLERS = 
{
  // --- FLOAT ---
  // Il faut l'attribut .range
  'float': (parameter,rng) => {
    const [min, max] = parameter.range;
    return rng.random_num(min, max);
  },

  // --- INTEGER ---
  // Il faut un attribut .range
  'integer': (parameter,rng) => {
    const [min, max] = parameter.range;
    return rng.random_int(min, max);
  },

  // --- BOOLEAN ---
  // on peut mettre un attribut optionnel .threshold
  'boolean': (parameter,rng) => {
    const p = parameter.threshold ?? 0.5;
    return rng.random_bool(p);
  },

  // --- CHOICE ---
  // Il faut un attrbut .choices avec les choix possibles
  'choice': (parameter,rng) => {
    return rng.random_choice(parameter.choices);
  },
};
