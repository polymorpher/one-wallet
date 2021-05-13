require('dotenv').config()
const localUrl = process.env.LOCAL_URL
const localPrivateKeys = process.env.LOCAL_PRIVATE_KEYS

// const mnemonic = process.env.MNEMONIC
const privateKeys = process.env.PRIVATE_KEYS
const url = process.env.URL

// const mainMnemonic = process.env.MAIN_MNEMONIC
const mainPrivateKeys = process.env.MAIN_PRIVATE_KEYS
const mainUrl = process.env.MAIN_URL

module.exports = {
  networkId: {
    Mainnet: 1,
    Testnet: 2,
    Local: 2,
  },
  gas: {
    gasLimit: parseInt(process.env.GAS_LIMIT),
    gasPrice: parseInt(process.env.GAS_PRICE)
  },
  local: {
    url: localUrl,
    privateKeys: localPrivateKeys,
  },
  test: {
    // mnemonic,
    privateKeys,
    url,
  },
  main: {
    // mnemonic: mainMnemonic,
    privateKeys: mainPrivateKeys,
    url: mainUrl
  }
}
