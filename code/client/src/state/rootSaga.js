import { sagaMiddleware } from './store'
import { walletSagas } from './modules/wallet'
import { cacheSagas } from './modules/cache'
import { globalSagas } from './modules/global'
import { balanceSagas } from './modules/balance'

function run () {
  sagaMiddleware.run(globalSagas)
  sagaMiddleware.run(walletSagas)
  sagaMiddleware.run(cacheSagas)
  sagaMiddleware.run(balanceSagas)
}

export default { run }
