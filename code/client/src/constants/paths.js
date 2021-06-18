export const base = process.env.PUBLIC_URL || ''
export default {
  root: base + '/',
  create: base + '/create',
  wallets: base + '/wallets',
  show: base + '/show/:address/:action?',
  restore: base + '/restore',
  showAddress: (address, action) => base + `/show/${address}${action ? `/${action}` : ''}`
}
