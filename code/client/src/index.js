import './app.less'
import React from 'react'
import ReactDOM from 'react-dom'
import rootSaga from './state/rootSaga'
import store, { history } from './state/store'
import Routes from './routes'
import { Provider } from 'react-redux'
import { ConnectedRouter } from 'connected-react-router'
import * as serviceWorker from './serviceWorker'
import { initAPI } from './api'

document.body.ontouchstart = function () {}

initAPI(store)

rootSaga.run()

ReactDOM.render(
  <Provider store={store}>
    <ConnectedRouter history={history}>
      <Routes />
    </ConnectedRouter>
  </Provider>,
  document.getElementById('root')
)

serviceWorker.unregister()
