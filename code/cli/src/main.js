// eslint-disable-next-line no-unused-vars
import config from './config.js'
import cmd from './cmd'
import { ensureDir } from './store'
import NewWallet from './scan'
import MakeWallet from './make'
import ListWallets from './list'
import { init, updateState } from './init'
// const cmd = require('./cmd')
// const store = require('./src/store')
// const importJSX = require('import-jsx')
// const NewWallet = importJSX('./src/scan')
// const rl = require('readline').createInterface({
//   input: process.stdin,
//   output: process.stdout
// })

const isCommand = (command) => cmd._[0] === command

// const hang = () => {
//   rl.question('Type "exit" and press enter to exit: ', response => {
//     if (response === 'exit') {
//       console.log(response)
//       rl.close()
//       process.exit(0)
//     }
//     hang()
//   })
// }

const mapping = {
  relayer: {
    beta: 'hiddenstate',
  },
  network: {
    dev: 'eth-ganache',
    mainnet: 'harmony-mainnet',
    testnet: 'harmony-testnet',
  }
}

const translate = (kind, s) => mapping?.[kind]?.[s] || s

async function main () {
  init()
  updateState({
    relayer: translate('relayer', cmd.relayer), network: translate('network', cmd.network), relayerSecret: cmd.password
  })
  await ensureDir()
  if (isCommand('scan')) {
    NewWallet()
  } else if (isCommand('make')) {
    MakeWallet({ lastResortAddress: cmd['recovery-address'], otpInput: cmd.code })
  } else if (isCommand('list')) {
    ListWallets()
  }
  // hang()
  // process.exit(0)
}

main()
