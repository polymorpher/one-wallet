import IconBTC from '../assets/btc.svg'
import IconETH from '../assets/eth.svg'
import IconUSDT from '../assets/tether.svg'
import IconDAI from '../assets/dai.svg'
import IconSushi from '../assets/sushi.svg'
import IconUSDC from '../assets/usdc.svg'
import IconAAVE from '../assets/aave.svg'
import IconBUSD from '../assets/busd.svg'
import IconBNB from '../assets/bnb.svg'
import IconONE from '../assets/harmony-icon.svg'
import ONEConstants from '../../../lib/constants'
import ONEUtil from '../../../lib/util'
import ONE from '../../../lib/onewallet'
import util from '../util'

export const KnownERC20 = {
  '1ETH': {
    icon: IconETH,
    symbol: '1ETH',
    name: 'Ethereum ETH',
    contractAddress: '0x6983D1E6DEf3690C4d616b13597A09e6193EA013'
  },
  '1WBTC': {
    icon: IconBTC,
    symbol: '1WBTC',
    name: 'Wrapped BTC',
    contractAddress: '0x3095c7557bCb296ccc6e363DE01b760bA031F2d9'
  },
  '1USDC': {
    icon: IconUSDC,
    symbol: '1USDC',
    name: 'USD Coin',
    contractAddress: '0x985458E523dB3d53125813eD68c274899e9DfAb4'
  },
  BUSD: {
    icon: IconBUSD,
    symbol: 'BUSD',
    name: 'Binance USD',
    contractAddress: '0xE176EBE47d621b984a73036B9DA5d834411ef734'
  },
  USDT: {
    icon: IconUSDT,
    symbol: '1USDT',
    name: 'Tether USD',
    decimals: 6,
    contractAddress: '0x3C2B8Be99c50593081EAA2A724F0B8285F5aba8f'
  },
  bscBUSD: {
    icon: IconBNB,
    symbol: 'bscBUSD',
    name: 'BUSD Token',
    contractAddress: '0x0aB43550A6915F9f67d0c454C2E90385E6497EaA'
  },
  '1SUSHI': {
    icon: IconSushi,
    symbol: '1SUSHI',
    name: 'SushiToken',
    contractAddress: '0xBEC775Cb42AbFa4288dE81F387a9b1A3c4Bc552A'
  },
  '1DAI': {
    icon: IconDAI,
    symbol: '1DAI',
    name: 'Dai Stablecoin',
    contractAddress: '0xEf977d2f931C1978Db5F6747666fa1eACB0d0339'
  },
  '1AAVE': {
    icon: IconAAVE,
    symbol: '1AAVE',
    name: 'Aave Token',
    contractAddress: '0xcF323Aad9E522B93F11c352CaA519Ad0E14eB40F'
  },
  bscUSDT: {
    icon: IconUSDT,
    symbol: 'bscUSDT',
    name: 'Binance USDT',
    contractAddress: '0x9a89d0e1b051640c6704dde4df881f73adfef39a'
  },
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

export const MetadataURITransformer = (url) => {
  const IPFSIO = /https:\/\/ipfs\.io\/ipfs\/(.+)/
  if (!url) {
    return url
  }
  const m = url.match(IPFSIO)
  if (m) {
    const hash = m[1]
    return util.replaceIPFSLink(hash)
  }
  return url
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
