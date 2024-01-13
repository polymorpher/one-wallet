import React, { useEffect, useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { Route, Switch, Redirect } from 'react-router-dom'
import { persistStore } from 'redux-persist'
import Paths from './constants/paths'
import Layout from 'antd/es/layout'
import Row from 'antd/es/row'
import Spin from 'antd/es/spin'
import SiderMenu, { SiderMenuV2 } from './components/SiderMenu'
import WalletHeader, { WalletHeaderV2 } from './components/WalletHeader'
import { NFTDashboardV2 } from './pages/Show/NFTDashboard'
import { ERC20GridV2 } from './components/ERC20Grid'
import { SwapV2 } from './pages/Show/Swap'
import { StakeV2 } from './pages/Show/Stake/Stake'
import CreatePage from './pages/Create'
import ContactDetailPage from './pages/Contacts/ContactDetail'
import ListPage from './pages/List'
import RestorePage from './pages/Restore'
import ShowPage from './pages/Show'
import ToolsPage from './pages/Tools'
import WalletAuth from './integration/WalletAuth'
import { walletActions } from './state/modules/wallet'
import { globalActions } from './state/modules/global'
import config from './config'
import util, { useWindowDimensions } from './util'
import Unwrap from './pages/Unwrap'
import cacheActions from './state/modules/cache/actions'
import Backup from './pages/Backup'
import Contacts from './pages/Contacts'
import querystring from 'query-string'
import message from './message'

const LocalRoutes = () => {
  const dispatch = useDispatch()
  const dev = useSelector(state => state.global.dev)
  const v2ui = useSelector(state => state.global.v2ui)
  const wallets = useSelector(state => state.wallet)
  const network = useSelector(state => state.global.network)
  const selectedAddress = useSelector(state => state.global.selectedWallet)
  const networkWallets = util.filterNetworkWallets(wallets, network)
  const { isMobile } = useWindowDimensions()
  const qs = querystring.parse(location.search)
  const needCodeUpdate = useSelector(state => state.cache.needCodeUpdate)
  const clientVersion = useSelector(state => state.cache.clientVersion[network])

  useEffect(() => {
    dispatch(cacheActions.fetchVersion({ network }))
    // dispatch(cacheActions.clearCode())
  }, [])
  useEffect(() => {
    if (needCodeUpdate || clientVersion !== config.version) {
      dispatch(cacheActions.updateClientVersion(config.version))
      dispatch(cacheActions.fetchCode({ network }))
    }
  }, [needCodeUpdate, clientVersion])

  useEffect(() => {
    if (isMobile && !qs.standalone && !window.navigator.standalone) {
      message.info(`Please install ${config.appName} as an app: Click "Share" button then "Add to Home Screen"`, 120)
      message.info(`Please open ${config.appName} from home screen app. Otherwise, iOS deletes your idle wallets after 7 days`, 120)
    }
  }, [])

  return (
    <Layout
      style={{
        minHeight: '100vh'
      }}
      className={v2ui ? 'v2ui' : ''}
    >
      {v2ui ? <SiderMenuV2 /> : <SiderMenu />}
      <Layout>
        {v2ui ? <WalletHeaderV2 /> : <WalletHeader />}
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
                dispatch(globalActions.setDev(!dev))
                return <Redirect to={Paths.root} />
              }}
            />
            <Route
              path={Paths.v2ui} render={() => {
                dispatch(globalActions.setV2Ui(!v2ui))
                return <Redirect to={Paths.root} />
              }}
            />
            <Route path={Paths.auth} component={WalletAuth} />
            <Route path={Paths.create} component={CreatePage} />
            <Route path={Paths.create1} render={() => <CreatePage showRecovery />} />
            <Route path={Paths.create2} render={() => <CreatePage expertMode showRecovery />} />
            <Route path={Paths.wallets} component={ListPage} />
            <Route path={Paths.restore} component={RestorePage} />
            <Route path={Paths.backup} component={Backup} />
            <Route path={Paths.contact} component={ContactDetailPage} exact />
            <Route path={Paths.contacts} component={Contacts} exact />
            {!v2ui && <Route path={Paths.show} component={ShowPage} />}
            <Route path={Paths.tools} component={ToolsPage} />
            <Route path={Paths.unwrap} component={Unwrap} />
            {/* Dedicated v2 routes. */}
            {v2ui && <Route path={Paths.overview} exact component={ShowPage} />}
            {v2ui && <Route path={Paths.nft} exact component={NFTDashboardV2} />}
            {v2ui && <Route path={Paths.assets} exact component={ERC20GridV2} />}
            {v2ui && <Route path={Paths.swap} exact component={SwapV2} />}
            {v2ui && <Route path={Paths.stake} exact component={StakeV2} />}
            {/* Fuzzy match so we still can render other sections in the tab fashion. */}
            {v2ui && <Route path={Paths.walletfuzzyaction} exact component={ShowPage} />}
            <Route
              exact
              path={Paths.root}
              render={() => {
                const hasWallets = networkWallets && networkWallets.length > 0
                if (!hasWallets) {
                  return <Redirect to={Paths.create} component={CreatePage} />
                }
                return v2ui
                  ? <Redirect to={Paths.showAddress(selectedAddress ?? networkWallets[0].address)} component={ShowPage} />
                  : <Redirect to={Paths.wallets} component={ListPage} />
              }}
            />
            {/* Fallthrough paths to handle any unrecognized paths. */}
            <Route
              path='*' exact render={() => {
                const hasWallets = networkWallets && networkWallets.length > 0
                if (!hasWallets) {
                  return <Redirect to={Paths.create} component={CreatePage} />
                }
                return v2ui
                  ? <Redirect to={Paths.showAddress(selectedAddress ?? networkWallets[0].address)} component={ShowPage} />
                  : <Redirect to={Paths.wallets} component={ListPage} />
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
    dispatch(globalActions.fetchPrice())
    setInterval(() => {
      if (!document.hidden) {
        dispatch(globalActions.fetchPrice())
      }
    }, config.priceRefreshInterval)
    persistStore(store.default, null, () => {
      dispatch(walletActions.autoMigrateWallets())
      dispatch(globalActions.migrate())

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
