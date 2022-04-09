const fs = require('fs').promises
const path = require('path')
const CACHE = process.env.CACHE || './relayer/cache'
const VERSION = process.env.CACHE || 'v0.16.1'
const VARS = {
  DEPLOY_FACTORY: 'ONEWalletFactory',
  DEPLOY_DEPLOYER: 'ONEWalletFactoryHelper',
  DEPLOY_CODE_HELPER: 'ONEWalletCodeHelper',
}

const SUFFIXES = {
  'eth-ganache': 'GANACHE',
  'harmony-mainnet': 'MAINNET',
  'harmony-testnet': 'TESTNET',
}

async function main () {
  const p = path.join(CACHE, VERSION)
  for (const [k, v] of Object.entries(VARS)) {
    for (const [ks, vs] of Object.entries(SUFFIXES)) {
      const pp = path.join(p, `${v}-${ks}`)
      const key = `${k}_${vs}`
      const content = await fs.readFile(pp, { encoding: 'utf-8' })
      const [address] = content.split(',')
      console.log(`${key}=${address}`)
    }
  }
}
main()