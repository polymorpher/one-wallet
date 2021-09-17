export const base = process.env.PUBLIC_URL || ''
export default {
  root: base + '/',
  dev: base + '/dev',
  create: base + '/create',
  create2: base + '/create2',
  wallets: base + '/wallets',
  restore: base + '/restore',
  unwrap: base + '/unwrap',

  show: base + '/show/:address/:action?',
  showAddress: (address, action) => base + `/show/${address}${action ? `/${action}` : ''}`,

  auth: base + '/auth/:action?/:address?',
  doRedirect: (action, address) => {
    if (!action) {
      return base + '/redirect'
    }
    if (!address) {
      return base + `/redirect/${action}`
    }
    return base + `/redirect/${action}/${address}`
  },
}
