const fs = require('fs').promises
const EVENT_LIST = process.env.EVENT_LIST || './scripts/events.txt'
const EVENT_MAP_OUT = process.env.EVENT_MAP_OUT || './scripts/events-map.txt'
const EVENT_MAP_OUT_JSON = process.env.EVENT_MAP_OUT_JSON || './lib/events-map.json'
const EVENT_PARAMS_OUT_JSON = process.env.EVENT_PARAMS_OUT_JSON || './lib/events-params.json'
const ONEUtil = require('../lib/util')
const PATTERN = /^event ([A-Za-z0-9]+)\((.*)\);$/
const PRECOMPILE_PATTERN = /^precompile_event ([A-Za-z0-9/]+) \((.*)\);$/
async function main () {
  const list = await fs.readFile(EVENT_LIST, { encoding: 'UTF-8' })
  const lines = list.split('\n')
  const hashMap = {}
  const hashMapJson = {}
  const paramsMapJson = {}
  for (let line of lines) {
    let m = line.match(PRECOMPILE_PATTERN)
    const isPrecompile = !!m
    if (!m) {
      m = line.match(PATTERN)
    }
    if (!m) {
      continue
    }
    const method = m[1]
    const args = m[2]
    const paramTypes = args.split(', ').map(e => e.trim().split(' ')[0].replace('tuple', ''))
    console.log(method, paramTypes)
    const sig = isPrecompile ? method : `${method}(${paramTypes.join(',')})`
    const hash = ONEUtil.hexString(ONEUtil.keccak(sig))
    hashMap[hash] = sig
    hashMapJson[hash] = method
    paramsMapJson[method] = {
      params: args ? args.split(', ').map(e => e.trim().split(' ')[0]) : [],
    }
    const amountIndex = args.split(', ').findIndex(a => a.trim().split(' ')[1] === 'amount')
    if (amountIndex >= 0) {
      paramsMapJson[method].amountIndex = amountIndex
    }
  }
  const out = JSON.stringify(hashMap, null, 2)
  const outJSON = JSON.stringify(hashMapJson, null, 2)
  const paramsOutJSON = JSON.stringify(paramsMapJson, null, 2)
  await fs.writeFile(EVENT_MAP_OUT, out, { encoding: 'UTF-8' })
  await fs.writeFile(EVENT_MAP_OUT_JSON, outJSON, { encoding: 'UTF-8' })
  await fs.writeFile(EVENT_PARAMS_OUT_JSON, paramsOutJSON, { encoding: 'UTF-8' })
}

main()
