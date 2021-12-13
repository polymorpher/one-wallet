import { sagaMiddleware } from './store'
import { walletSagas } from './modules/wallet'
import { cacheSagas } from './modules/cache'
import { globalSagas } from './modules/global'

function run () {
  sagaMiddleware.run(globalSagas)
  sagaMiddleware.run(walletSagas)
  sagaMiddleware.run(cacheSagas)
}

export default { run }
