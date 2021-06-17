export const base = process.env.PUBLIC_URL || ''
export default {
  root: base + '/',
  create: base + '/create',
  wallets: base + '/wallets',
  transfer: base + '/transfer/:address',
  recover: base + '/recover/:address',
  show: base + '/show/:address',
  restore: base + '/restore',
  showAddress: (address) => base + `/show/${address}`
}
