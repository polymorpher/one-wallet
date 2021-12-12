import { sagaMiddleware } from './store'
import { walletSagas } from './modules/wallet'
import { globalSagas } from './modules/global'

function run () {
  sagaMiddleware.run(globalSagas)
  sagaMiddleware.run(walletSagas)
}

export default { run }
