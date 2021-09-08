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
    contractAddress: '0xE176EBE47d621b984a73036B9DA5d834411ef734'
  },
  VIPER: {
    icon: IconVIPER,
    symbol: 'VIPER',
    name: 'Viper',
    contractAddress: '0xEa589E93Ff18b1a1F1e9BaC7EF3E86Ab62addc79'
  },
  ONEMOON: {
    icon: IconONEMOON,
    symbol: 'ONEMOON',
    name: 'OneMoon',
    contractAddress: '0xCB35e4945c7F463c5CCBE3BF9f0389ab9321248F'
  }
}

export const HarmonyONE = {
  key: 'one',
  icon: IconONE,
  symbol: 'ONE',
  name: 'Harmony ONE',
  contractAddress: null,
  priority: 1e+6,
}

export const DefaultTrackedERC20 = network => {
  if (network !== 'harmony-mainnet') {
    return []
  }
  return Object.keys(KnownERC20).map(symbol => {
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
}

export const withKeys = (trackedTokens) => {
  return trackedTokens.map(tt => ({ ...tt, key: ONEUtil.hexView(ONE.computeTokenKey(tt).hash) }))
}
