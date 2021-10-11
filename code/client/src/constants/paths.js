export const base = process.env.PUBLIC_URL || ''
export default {
  root: base + '/',
  dev: base + '/dev',
  create: base + '/create', // simplified, mobile oriented
  create1: base + '/create1', // desktop mode
  create2: base + '/create2', // expert mode
  wallets: base + '/wallets',
  restore: base + '/restore',
  tools: base + '/tools',
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
