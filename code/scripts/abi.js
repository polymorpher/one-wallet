const fs = require('fs').promises
const path = require('path')
const contractDir = path.join(__dirname, '..', 'build', 'contracts')
const abiDir = path.join(__dirname, '..', 'build', 'abi')
async function main () {
  await fs.mkdir(abiDir, { recursive: true })
  const contractFiles = await fs.readdir(contractDir)
  for (const f of contractFiles) {
    const contract = require(path.join(contractDir, f))
    if (contract.abi) {
      await fs.writeFile(path.join(abiDir, f), JSON.stringify(contract.abi))
    }
  }
}
main()
