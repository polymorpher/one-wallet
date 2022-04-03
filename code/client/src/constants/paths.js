export const base = process.env.PUBLIC_URL || ''
export default {
  root: base + '/',
  dev: base + '/dev',
  v2ui: base + '/v2ui',
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
}
