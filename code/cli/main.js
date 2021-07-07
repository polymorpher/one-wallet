// eslint-disable-next-line no-unused-vars
const config = require('./config')
const cmd = require('./cmd')
const store = require('./src/store')
const importJSX = require('import-jsx')
const NewWallet = importJSX('./src/scan')
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

async function main () {
  await store.ensureDir()
  if (isCommand('scan')) {
    NewWallet({ network: cmd.network })
  } else if (isCommand('make')) {

  }
  // hang()
  // process.exit(0)
}

main()
