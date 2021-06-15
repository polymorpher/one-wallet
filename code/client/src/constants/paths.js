const base = process.env.PUBLIC_URL
const Paths = {
  root: base + '/',
  create: base + '/create',
  list: base + '/list',
  transfer: base + '/:address/transfer',
  recover: base + '/:address/recover',
  show: base + '/:address/show',
  restore: base + '/restore'
}

export default Paths
