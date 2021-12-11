import { sagaMiddleware } from './store'
import { walletSagas } from './modules/wallet'
import { cacheSagas } from './modules/cache'

function run () {
  sagaMiddleware.run(walletSagas)
  sagaMiddleware.run(cacheSagas)
}

export default { run }
