import React, { useEffect, useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { Route, Switch } from 'react-router-dom'
import { persistStore } from 'redux-persist'
// import queryString from 'query-string'
// import styled from 'styled-components'
import Paths from './constants/paths'
import { Layout, Row, Spin } from 'antd'
import SiderMenu from './components/SiderMenu'
import WalletHeader from './components/WalletHeader'
import CreatePage from './pages/Create'
import ListPage from './pages/List'
import RecoverPage from './pages/Recover'
import TransferPage from './pages/Transfer'

const LocalRoutes = ({ tier, loggedIn, authenticating, creationTime }) => {
  return (
    <Layout>
      <Layout.Sider trigger={null} collapsible collapsed={this.state.collapsed}>
        <SiderMenu />
      </Layout.Sider>
      <Layout.Header>
        <WalletHeader />
      </Layout.Header>
      <Layout.Content>
        <Switch>
          <Route path={Paths.create} component={CreatePage} />
          <Route path={Paths.list} component={ListPage} />
          <Route path={Paths.recover} component={RecoverPage} />
          <Route path={Paths.transfer} component={TransferPage} />
          <Route component={ListPage} />
        </Switch>
      </Layout.Content>
    </Layout>
  )
}
const Routes = () => {
  const authenticating = useSelector(state => state.user.loading)
  const loggedIn = useSelector(state => state.user.loggedIn)
  const tier = useSelector(state => state.user.user && state.user.user.tier)
  const dispatch = useDispatch()
  const [rehydrated, setRehydrated] = useState(false)
  useEffect(() => {
    const store = require('./state/store')
    dispatch(userActions.user.fetchUser())
    dispatch(userActions.user.fetchSites())
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
        <LocalRoutes tier={tier} authenticating={authenticating} loggedIn={loggedIn} />
      </Route>
    </Switch>
  )
}

export default Routes
