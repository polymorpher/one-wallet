const fs = require('fs').promises
const path = require('path')
const IONEWalletFactoryHelper = require('../build/contracts/IONEWalletFactoryHelper.json')
async function main () {
  const p = path.join('build', 'abi')
  await fs.mkdir(p, { recursive: true })
  await fs.writeFile('build/abi/IONEWalletFactoryHelper.json', JSON.stringify(IONEWalletFactoryHelper.abi))
}
main()
