import {
  createStore,
  applyMiddleware,
  compose
} from 'redux'
import createSagaMiddleware from 'redux-saga'
import { createBrowserHistory } from 'history'
import { routerMiddleware } from 'connected-react-router'
import rootReducer from './rootReducer'

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

export default store
