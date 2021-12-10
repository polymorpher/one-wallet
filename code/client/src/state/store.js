import {
  createStore,
  applyMiddleware,
  compose
} from 'redux'
import createSagaMiddleware from 'redux-saga'
import { createBrowserHistory } from 'history'
import { routerMiddleware } from 'connected-react-router'
import rootReducer, { rootConfig } from './rootReducer'
import { crosstab } from './crosstab'
// Create a history of your choosing (we're using a browser history in this case).
export const history = createBrowserHistory()

export const sagaMiddleware = createSagaMiddleware()

const composeEnhancers = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose

const store = createStore(
  rootReducer(history),
  undefined,
  composeEnhancers(
    applyMiddleware(
      sagaMiddleware,
      routerMiddleware(history)
    )
  )
)
crosstab(store, rootConfig, {
  blocklist: ['router', 'lastAction'],
  allowActions: [
    'UPDATE_WALLET',
    'DELETE_WALLET',
    'SET_NETWORK',
    'SET_KNOWN_ADDRESS',
    'DELETE_KNOWN_ADDRESS',
    'BIND_DOMAIN',
    'USER_ACKNOWLEDGED_TO_SAVE_ADDRESS',
    'USER_ACKNOWLEDGED_NEW_ROOT',
    'USER_SKIP_VERSION',
  ]
})

export default store
