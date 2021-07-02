import './app.less'
import React from 'react'
import ReactDOM from 'react-dom'
import rootSaga from './state/rootSaga'
import store, { history } from './state/store'
import Routes from './routes'
import { Provider } from 'react-redux'
import { ConnectedRouter } from 'connected-react-router'
import * as serviceWorker from './serviceWorker'
import { initAPI, initBlockchain } from './api'
import * as Sentry from '@sentry/react'
import { Integrations } from '@sentry/tracing'
import config from './config'

if (!config.debug) {
  Sentry.init({
    dsn: config.defaults.sentryDsn,
    integrations: [new Integrations.BrowserTracing()],
    tracesSampleRate: 1.0
  })
}

document.body.ontouchstart = function () {}

initAPI(store)
initBlockchain(store)

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
