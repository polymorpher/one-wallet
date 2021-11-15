const fs = require('fs').promises
const EVENT_LIST = process.env.EVENT_LIST || './scripts/events.txt'
const EVENT_MAP_OUT = process.env.EVENT_MAP_OUT || './scripts/events-map.txt'
const ONEUtil = require('../lib/util')
const PATTERN = /^event ([A-Za-z0-9]+)\((.*)\);$/
async function main () {
  const list = await fs.readFile(EVENT_LIST, { encoding: 'UTF-8' })
  const lines = list.split('\n')
  const hashMap = {}
  for (let line of lines) {
    const m = line.match(PATTERN)
    if (!m) {
      continue
    }
    const method = m[1]
    const args = m[2]
    if (!args) {
      const sig = `${method}()`
      const hash = ONEUtil.hexString(ONEUtil.keccak(sig))
      hashMap[hash] = sig
    }
    const paramTypes = args.split(', ').map(e => e.trim().split(' ')[0].replace('tuple', ''))
    console.log(method, paramTypes)
    const sig = `${method}(${paramTypes.join(',')})`
    const hash = ONEUtil.hexString(ONEUtil.keccak(sig))
    hashMap[hash] = sig
  }
  const out = JSON.stringify(hashMap, null, 2)
  console.log(out)
  await fs.writeFile(EVENT_MAP_OUT, out, { encoding: 'UTF-8' })
}

main()
