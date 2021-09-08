const IERC20Uniswap = require('../external/IERC20Uniswap.json')
const IUniswapV2Factory = require('../external/IUniswapV2Factory.json')
const IUniswapV2Pair = require('../external/IUniswapV2Pair.json')
// const IUniswapV2Router02 = require('../external/IUniswapV2Router02.json')
const ONEConstants = require('../lib/constants')
const contract = require('@truffle/contract')
const config = require('../config')
const { Account } = require('@harmony-js/account')
const fs = require('fs').promises

const getTokenInfo = async (t) => {
  const [symbol, name, decimal, supply] = await Promise.all([t.methods.symbol().call(), t.methods.name().call(), t.methods.decimals().call(), t.methods.totalSupply().call()])
  return {
    symbol, name, decimal, supply, address: t.options.address
  }
}
// Obtain the list of pairs and underlying tokens from Sushiswap deployed on Harmony
// truffle execute scripts/sushi.js --network=harmony-mainnet
module.exports = (callback) => {
  const f = async () => {
    const factory = new web3.eth.Contract(IUniswapV2Factory, ONEConstants.Sushi.FACTORY)
    const numPairs = await factory.methods.allPairsLength().call()
    console.log(numPairs)
    console.log(`Found ${numPairs} at factory: ${factory.options.address}`)
    const pairs = []

    const tokens = {}
    for (let i = 0; i < numPairs; i++) {
      const pairAddress = await factory.methods.allPairs(i).call()
      const pair = new web3.eth.Contract(IUniswapV2Pair, pairAddress)
      const t0Addr = await pair.methods.token0().call()
      const t1Addr = await pair.methods.token1().call()
      const t0 = new web3.eth.Contract(IERC20Uniswap, t0Addr)
      const t1 = new web3.eth.Contract(IERC20Uniswap, t1Addr)
      const t0Info = await getTokenInfo(t0)
      const t1Info = await getTokenInfo(t1)
      if (!tokens[t0Addr]) {
        tokens[t0Addr] = t0Info
      }
      if (!tokens[t1Addr]) {
        tokens[t1Addr] = t1Info
      }
      pairs.push({ t0: t0Addr, t1: t1Addr, pair: pairAddress })
      console.log(`Processed ${t0Info.symbol} ${t1Info.symbol} (pair address=${pairAddress}); Total tokens=${Object.keys(tokens).length}; Total pairs=${pairs.length}`)
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
    const outPath = process.env.OUT_PATH || './data/sushiswap.json'
    await fs.writeFile(outPath, JSON.stringify({ pairs, tokens }, null, 2))
    console.log(`Processed all. Total tokens=${Object.keys(tokens).length}; Total pairs=${pairs.length}`)
  }
  f().catch(ex => {
    console.error(ex)
  })
}
