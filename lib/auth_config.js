var AuthConfig = Object.freeze({
  PARENT_NUMBER_OF_LEAFS: Math.pow(2, 4),
  CHILD_NUMBER_OF_LEAFS: Math.pow(2, 3),
  CHILD_DEPTH_OF_CACHED_LAYER: 0,
  HASH_CHAIN_LEN: 2,
  MNEM_WORDS: 'child senior sister dance clarify donor segment arrest ride snack lab twin' // Seed of authenticator
})

module.exports = AuthConfig
