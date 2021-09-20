import React, { useEffect, useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { Route, Switch, Redirect } from 'react-router-dom'
import { persistStore } from 'redux-persist'
import Paths from './constants/paths'
import { Layout, Row, Spin } from 'antd'
import SiderMenu from './components/SiderMenu'
import WalletHeader from './components/WalletHeader'
import CreatePage from './pages/Create'
import ListPage from './pages/List'
import RestorePage from './pages/Restore'
import ShowPage from './pages/Show'
import WalletAuth from './integration/WalletAuth'
import { walletActions } from './state/modules/wallet'
import config from './config'
import util, { useWindowDimensions } from './util'
import Unwrap from './pages/Unwrap'

const LocalRoutes = () => {
  const dispatch = useDispatch()
  const dev = useSelector(state => state.wallet.dev)
  const wallets = useSelector(state => state.wallet.wallets)
  const network = useSelector(state => state.wallet.network)
  const networkWallets = util.filterNetworkWallets(wallets, network)
  const { isMobile } = useWindowDimensions()
  return (
    <Layout style={{
      minHeight: '100vh'
    }}
    >
      <SiderMenu />
      <Layout>
        <WalletHeader />
        <Layout.Content
          style={
            {
              paddingBottom: isMobile ? 0 : 32,
              paddingTop: isMobile ? 8 : 32,
              paddingLeft: isMobile ? 0 : 32,
              paddingRight: isMobile ? 0 : 32
            }
          }
        >
          <Switch>
            <Route
              path={Paths.dev} render={() => {
                dispatch(walletActions.setDev(!dev))
                return <Redirect to={Paths.root} />
              }}
            />
            <Route path={Paths.auth} component={WalletAuth} />
            <Route path={Paths.create} component={CreatePage} />
            <Route path={Paths.create1} render={() => <CreatePage showRecovery />} />
            <Route path={Paths.create2} render={() => <CreatePage expertMode showRecovery />} />
            <Route path={Paths.wallets} component={ListPage} />
            <Route path={Paths.restore} component={RestorePage} />
            <Route path={Paths.show} component={ShowPage} />
            <Route path={Paths.unwrap} component={Unwrap} />
            <Route
              exact
              path={Paths.root}
              render={() => {
                return (
                  networkWallets && networkWallets.length
                    ? <Redirect to={Paths.wallets} component={ListPage} />
                    : <Redirect to={Paths.create} component={CreatePage} />
                )
              }}
            />
          </Switch>
        </Layout.Content>
      </Layout>
    </Layout>
  )
}

const Routes = () => {
  const dispatch = useDispatch()
  const [rehydrated, setRehydrated] = useState(false)
  useEffect(() => {
    const store = require('./state/store')
    dispatch(walletActions.fetchPrice())
    setInterval(() => {
      dispatch(walletActions.fetchPrice())
    }, config.priceRefreshInterval)
    persistStore(store.default, null, () => {
      setRehydrated(true)
    })
  }, [dispatch])

  if (!rehydrated) {
    return (
      <Layout>
        <Layout.Content>
          <Row type='flex' justify='center' align='middle' style={{ minHeight: '100vh' }}>
            <Spin size='large' />
          </Row>
        </Layout.Content>
      </Layout>
    )
  }

  return (
    <Switch>
      <Route>
        <LocalRoutes />
      </Route>
    </Switch>
  )
}

export default Routes
