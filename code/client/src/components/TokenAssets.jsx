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

export const HarmonyPunk = {
  contractAddress: '0xb938147a4f7a17e0c722eb82b82fb4436ae64d58',
  fakeImagePattern: /https:\/\/na6t7p57pk\.execute-api\.us-east-1\.amazonaws.com\/onePunkURL\?index=([0-9]+)/,
  realImageTemplate: 'https://punk-one-assets.s3.amazonaws.com/one_punk_{{id}}.png'
}

export const NFTMetadataTransformer = ({ contractAddress, metadata }) => {
  if (contractAddress === HarmonyPunk.contractAddress) {
    const m = metadata.image.match(HarmonyPunk.fakeImagePattern)
    if (m) {
      const image = HarmonyPunk.realImageTemplate.replace(/{{id}}/, m[1])
      return { ...metadata, image }
    }
    return metadata
  }
  return metadata
}

export const DefaultNFTs = [{
  contractAddress: '0x977CA6A224002C678f96E4e87401d5d6F682EF7a',
  tokenType: ONEConstants.TokenType.ERC1155,
  tokenId: 2
}]

export const TestPunk = {
  id: '987',
  name: 'Punk 987',
  image: 'https://na6t7p57pk.execute-api.us-east-1.amazonaws.com/onePunkURL?index=987',
  attributes: [
    {
      value: 'Nerd Glasses',
      trait_type: 'Eyes'
    },
    {
      value: 'White Male',
      trait_type: 'Body'
    },
    {
      value: 'Muttonchops',
      trait_type: 'Beard'
    }
  ]
}
