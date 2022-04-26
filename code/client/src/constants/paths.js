export const base = process.env.PUBLIC_URL || ''

export default {
  root: base + '/',
  dev: base + '/dev', // opt-in / opt-out of the dev mode
  v2ui: base + '/v2ui', // opt-in / opt-out of the v2ui
  create: base + '/create', // simplified, mobile oriented
  create1: base + '/create1', // desktop mode
  create2: base + '/create2', // expert mode
  wallets: base + '/wallets',
  restore: base + '/restore',
  address: base + '/contacts/:address',
  addressDetail: (address) => base + `/contacts/${address}`,
  tools: base + '/tools',
  toolLink: base + '/tools/:tool',
  toolOpen: (tool) => base + (tool ? `/tools/${tool}` : '/tools'),
  unwrap: base + '/unwrap',

  show: base + '/show/:address/:action?',
  showAddress: (address, action) => base + `/show/${address}${action ? `/${action}` : ''}`,

  auth: base + '/auth/:action?/:address?',

  doAuth: (action, address) => {
    if (!action) {
      return base + '/auth'
    }
    if (!address) {
      return base + `/auth/${action}`
    }
    return base + `/auth/${action}/${address}`
  },

  // v2 only
  // The url structure should be used for matching.
  matchStructure: '/:category?/:address?/:section?',
  overview: base + '/show/:address',
  nft: base + '/show/:address/nft',
  assets: base + '/show/:address/assets',
  swap: base + '/show/:address/swap',
  stake: base + '/show/:address/stake',
  // TODO: switching v1 path to v2 with above structure.
}

export const UrlCategory = {
  WALLET: 'show',
  TOOLS: 'tools',
  RESTORE: 'restore',
  AUTH: 'auth',
  CONTACTS: 'contacts',
}
