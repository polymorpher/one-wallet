import { sagaMiddleware } from './store'
import { walletSagas } from './modules/wallet'

function run () {
  sagaMiddleware.run(walletSagas)
}

export default { run }
