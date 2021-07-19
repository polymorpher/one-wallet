import IconBUSD from '../assets/busd.svg'
import IconONE from '../assets/harmony-icon.svg'
import IconVIPER from '../assets/viperswap.png'
import IconONEMOON from '../assets/onemoon.png'
import ONEConstants from '../../../lib/constants'
import ONEUtil from '../../../lib/util'
import ONE from '../../../lib/onewallet'

export const KnownERC20 = {
  BUSD: {
    icon: IconBUSD,
    symbol: 'BUSD',
    name: 'Binance USD',
    contractAddress: '0xe176ebe47d621b984a73036b9da5d834411ef734'
  },
  VIPER: {
    icon: IconVIPER,
    symbol: 'VIPER',
    name: 'Viper',
    contractAddress: '0xea589e93ff18b1a1f1e9bac7ef3e86ab62addc79'
  },
  ONEMOON: {
    icon: IconONEMOON,
    symbol: 'ONEMOON',
    name: 'OneMoon',
    contractAddress: '0xcb35e4945c7f463c5ccbe3bf9f0389ab9321248f'
  }
}

export const HarmonyONE = {
  key: 'one',
  icon: IconONE,
  symbol: 'ONE',
  name: 'Harmony ONE',
  contractAddress: null
}

export const DefaultTrackedERC20 = Object.keys(KnownERC20).map(symbol => {
  const { contractAddress, icon, name } = KnownERC20[symbol]
  return {
    tokenType: ONEConstants.TokenType.ERC20,
    tokenId: 0,
    contractAddress,
    icon,
    name,
    symbol,
  }
})

export const withKeys = (trackedTokens) => {
  return trackedTokens.map(tt => ({ ...tt, key: ONEUtil.hexView(ONE.computeTokenKey(tt).hash) }))
}
