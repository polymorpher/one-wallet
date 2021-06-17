export const base = process.env.PUBLIC_URL || ''
export default {
  root: base + '/',
  create: base + '/create',
  list: base + '/list',
  transfer: base + '/:address/transfer',
  recover: base + '/:address/recover',
  show: base + '/:address/show',
  restore: base + '/restore',
  showAddress: (address) => base + `/${address}/show`
}
