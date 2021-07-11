import { init, updateState } from './init'
// eslint-disable-next-line no-unused-vars
import config from './config.js'
import cmd from './cmd'
import { ensureDir } from './store'
import NewWallet from './scan'
import MakeWallet from './make'
import ListWallets from './list'
import DoSend from './send'

const isCommand = (command) => cmd._[0] === command

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
  } else if (isCommand('send')) {
    const locator = {}
    if (cmd.wallet) {
      if (cmd.wallet.startsWith('one1')) {
        locator.address = cmd.wallet
      } else {
        locator.name = cmd.wallet
      }
      if (locator.name === 'main') locator.name = ''
    }
    DoSend({ destInput: cmd.address, amountInput: cmd.amount, otpInput: cmd.code, ...locator })
  }
  // hang()
  // process.exit(0)
}

main()
