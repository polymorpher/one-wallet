import yargs from 'yargs/yargs'
import { hideBin } from 'yargs/helpers'
import config from './config'

const argv = yargs(hideBin(process.argv))
  .command('scan', 'Build a new wallet and show its setup QR code in terminal')
  .command('make <recovery-address> <code>', 'Deploy the wallet you just built to blockchain and make it your "main" wallet', yargs => {
    yargs.positional('recovery-address', { describe: 'The wallet address which, by sending 1 ONE from that wallet to this new wallet, would trigger the recovery process such that all remaining funds of this wallet would be sent to that address', type: 'string' })
    yargs.positional('code', { describe: 'The current 6-digit code from Google Authenticator for the wallet you just built', type: 'string' })
  })
  .command('send <address> <amount> <code>', 'Send funds to another address', yargs => {
    yargs.positional('address', { describe: 'The address (one1...) of which the funds would be sent to', type: 'string' })
    yargs.positional('amount', { describe: 'The amount to be sent (in ONE)', type: 'number' })
    yargs.positional('code', { describe: 'The current 6-digit code from Google Authenticator', type: 'string' })
  })
  .command('main <wallet>', 'Change "main" wallet', yargs => {
    yargs.positional('wallet', { describe: 'The name or address of the wallet you want to assign to "main"', type: 'string' })
  })
  .command('list', 'Show all wallets (address, name, balance)')
  .options({
    network: {
      alias: 'n',
      type: 'string',
      default: 'mainnet',
      describe: 'The network you want to use. Can be mainnet, testnet, or any valid URL',
    },
    relayer: {
      alias: 'r',
      type: 'string',
      default: 'beta',
      describe: 'The relayer you want to use. Can be "beta" (hosted by ONE Wallet) or any valid URL'
    },
    password: {
      alias: 'p',
      type: 'string',
      default: config.defaults.relayerSecret,
      describe: 'The password for accessing the Relayer. Default is "onewallet" which is password for the "beta" relayer hosted by ONE Wallet.'
    },
    wallet: {
      alias: 'w',
      type: 'string',
      describe: 'The wallet you are going to use for transfer funds. By default, the main wallet is used, which is the last wallet you created'
    },
    store: {
      alias: 's',
      type: 'string',
      default: 'wallets',
      describe: 'Path of which your wallet data is stored. By default the data is stored in a subdirectory "wallets" where this command line tool is executed.'
    }
  })
  .version(`${config.version}`)
  .demandCommand(1)
  .strict()
  .argv

export default argv
