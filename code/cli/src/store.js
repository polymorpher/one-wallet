const fs = require('fs').promises
const path = require('path')
const config = require('../config')
const { HarmonyAddress } = require('@harmony-js/crypto')
const StoreManager = {
  path: config.defaultStorePath,
  logger: config.debug ? console.log : () => {}
}

const updateStorePath = (path) => {
  StoreManager.path = path
}

const setLogger = (logger) => {
  StoreManager.logger = logger
}

const ensureDir = async () => {
  try {
    await fs.access(StoreManager.path)
  } catch (ex) {
    await fs.mkdir(StoreManager.path)
  }
}

const completeWallet = async ({ wallet }) => {
  const file = path.join(StoreManager.path, `${new HarmonyAddress(wallet.address).bech32}-${wallet.name}`)
  const tempFile = path.join(StoreManager.path, 'temp')
  await fs.rename(tempFile + '.tree', file + '.tree')
  await fs.rm(tempFile)
  await fs.writeFile(file, JSON.stringify(wallet), { encoding: 'utf-8' })
}

const storeIncompleteWallet = async ({ state, layers }) => {
  const file = path.join(StoreManager.path, 'temp')
  await fs.rm(file, { force: true })
  await fs.rm(file + '.tree', { force: true })
  const merged = new Uint8Array(layers[0].byteLength * 2)
  let cursor = 0
  for (let i = 0; i < layers.length; i += 1) {
    merged.set(layers[i], cursor)
    cursor += layers[i].byteLength
  }
  return Promise.all([
    fs.writeFile(file, JSON.stringify(state), { encoding: 'utf-8' }),
    fs.writeFile(file + '.tree', merged)
  ])
}

const loadIncompleteWallet = async () => {
  const file = path.join(StoreManager.path, 'temp')
  const stateJson = await fs.readFile(file, { encoding: 'utf-8' })
  const state = JSON.parse(stateJson)
  const { layers, error } = await loadWalletLayers({ path: 'temp' })
  return { state, layers, error }
}

const ONE_WALLET_PATTERN = /^(one1[0-9a-z]+)-([a-zA-Z-]+)$/

const listWallets = async () => {
  const files = await fs.readdir(StoreManager.path)
  const wallets = []
  for (const f of files) {
    const match = f.match(ONE_WALLET_PATTERN)
    if (match) {
      wallets.push({ address: match[1], name: match[2], file: path.join(StoreManager.path, f) })
    }
  }
  return wallets
}

const readMain = async () => {
  const fname = path.join(StoreManager.path, 'main')
  try {
    const json = await fs.readFile(fname, { encoding: 'utf-8' })
    return JSON.parse(json)
  } catch (ex) {
    StoreManager.logger(ex)
  }
}

const saveToMain = async ({ address, name }) => {
  const fname = path.join(StoreManager.path, 'main')
  const file = path.join(StoreManager.path, `${new HarmonyAddress(address).bech32}`)
  await fs.writeFile(fname, JSON.stringify({ address, name, file }), { encoding: 'utf-8' })
}

const findWallet = async ({ address, name }) => {
  const wallets = await listWallets()
  if (address) {
    return wallets.find(e => e.address === new HarmonyAddress(address).bech32)
  }
  if (name) {
    return wallets.find(e => e.name === name)
  }
  return readMain()
}

const loadWalletState = async ({ address, name }) => {
  try {
    const { file } = findWallet({ address, name })
    const p = path.join(StoreManager.path, file)
    const walletJson = await fs.readFile(p, { encoding: 'utf-8' })
    const wallet = JSON.parse(walletJson)
    return { wallet }
  } catch (ex) {
    StoreManager.logger(ex)
    return { error: ex }
  }
}

const loadWalletLayers = async ({ address, name, path }) => {
  try {
    const { file } = path ? { file: path } : findWallet({ address, name })
    const p = path.join(StoreManager.path, file)
    const layers = []
    const layersBin = await fs.readFile(p + '.tree')
    const numLayers = Math.ceil(Math.log2(layersBin.byteLength))
    let cursor = 0
    let layerLength = layersBin.byteLength / 2
    for (let i = 0; i < numLayers; i += 1) {
      layers[i] = layersBin.subarray(cursor, cursor + layerLength)
      cursor = cursor + layerLength
      layerLength /= 2
    }
    return { layers }
  } catch (ex) {
    StoreManager.logger(ex)
    return { error: ex }
  }
}

module.exports = { ensureDir, storeIncompleteWallet, completeWallet, updateStorePath, loadWalletState, loadWalletLayers, setLogger, saveToMain, readMain, loadIncompleteWallet }
