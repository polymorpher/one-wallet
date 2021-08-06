const baseParameters = {
  hasher: process.env.DEFAULT_HASHER || 'sha256',
  baseRandomness: parseInt(process.env.BASE_RANDOMNESS || 20),
  randomnessDamping: parseInt(process.env.RANDOMNESS_DAMPING || 2),
  argon2Damping: parseInt(process.env.ARGON2_DAMPING || 2),
}

module.exports = {
  // keys: regex for version matching; values: hasher, baseRandomness, randomnessDamping, argon2Damping
  '.*': {
    ...baseParameters
  }
}
