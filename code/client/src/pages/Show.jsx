import React, { useEffect, useState } from 'react'
import { useDispatch, useSelector, batch } from 'react-redux'
import { useHistory, useRouteMatch, Redirect, useLocation, matchPath } from 'react-router'
import Paths from '../constants/paths'
import WalletConstants from '../constants/wallet'
import walletActions from '../state/modules/wallet/actions'
import { globalActions } from '../state/modules/global'
import { balanceActions } from '../state/modules/balance'
import util from '../util'
import ONEConstants from '../../../lib/constants'

import About from './Show/About'
import Recovery from './Show/Recovery'
import DoRecover from './Show/DoRecover'
import Call from './Show/Call'
import CheckForwardState from './Show/CheckForwardState'
import Warnings from './Show/Warnings'

import AnimatedSection from '../components/AnimatedSection'

import { ERC20Grid } from '../components/ERC20Grid'
import { HarmonyONE } from '../components/TokenAssets'
import Send from './Show/Send'
import SetRecovery from './Show/SetRecovery'
import Balance from './Show/Balance'
import WalletTitle from '../components/WalletTitle'
import PurchaseDomain from './Show/PurchaseDomain'
import Upgrade from './Show/Upgrade'
import TransferDomain from './Show/TransferDomain'
import Sign from './Show/Sign'
import Swap from './Show/Swap'
import Gift from './Show/Gift'
import QRCode from './Show/QRCode'
import Scan from './Show/Scan'
import NFTDashboard from './Show/NFTDashboard'
import Reclaim from './Show/Reclaim'
import Extend from './Show/Extend'
import CheckRoots from './Show/CheckRoots'
import Limit from './Show/Limit'
import TransactionViewer from './Show/TransactionViewer'

const tabList = [
  { key: 'coins', tab: 'Coins' },
  { key: 'nft', tab: 'Collectibles' },
  { key: 'about', tab: 'About' },
  { key: 'help', tab: 'Recover' },
  { key: 'swap', tab: 'Swap' },
  { key: 'gift', tab: 'Gift' },
  { key: 'call', tab: 'Call', dev: true, expert: true },
  { key: 'sign', tab: 'Sign', dev: true, expert: true },
  { key: 'qr' },
  { key: 'scan' },
  {
    key: 'transactions',
    tab: 'Transactions',
    requireNetwork (network) {
      return network.startsWith('harmony')
    }
  },
]

const SectionList = [
  'transfer',
  'limit',
  'recover',
  'setRecoveryAddress',
  'domain',
  'domainTransfer',
  'reclaim',
  'extend',
]

const SpecialCommands = [
  'upgrade'
]

const Show = () => {
  const history = useHistory()
  const location = useLocation()
  const dispatch = useDispatch()

  const wallets = useSelector(state => state.wallet)
  const match = useRouteMatch(Paths.show)
  const { address: routeAddress, action } = match ? match.params : {}
  const oneAddress = util.safeOneAddress(routeAddress)
  const address = util.safeNormalizedAddress(routeAddress)
  const selectedAddress = useSelector(state => state.global.selectedWallet)
  const wallet = wallets[address] || {}
  const [section, setSection] = useState(action)
  const [command, setCommand] = useState(action)
  const network = useSelector(state => state.global.network)
  const [activeTab, setActiveTab] = useState('coins')
  const { expert } = wallet
  const dev = useSelector(state => state.global.dev)

  useEffect(() => {
    if (!wallet.address) {
      return history.push(Paths.wallets)
    }
    if (address && (address !== selectedAddress)) {
      dispatch(globalActions.selectWallet(address))
    }
    const fetch = () => dispatch(balanceActions.fetchBalance({ address }))
    const handler = setInterval(() => {
      if (!document.hidden) { fetch() }
    }, WalletConstants.fetchBalanceFrequency)
    batch(() => {
      fetch()
      dispatch(walletActions.fetchWallet({ address }))
    })
    return () => { clearInterval(handler) }
  }, [address])

  const selectedToken = wallet?.selectedToken || HarmonyONE

  useEffect(() => {
    const m = matchPath(location.pathname, { path: Paths.show })
    const { action } = m ? m.params : {}
    if (action !== 'nft' && action !== 'transfer' && selectedToken.key !== 'one' && selectedToken.tokenType !== ONEConstants.TokenType.ERC20) {
      dispatch(walletActions.setSelectedToken({ token: null, address }))
    }
    if (SpecialCommands.includes(action)) {
      setCommand(action)
    } else {
      setCommand('')
    }
    if (tabList.find(t => t.key === action)) {
      setSection(undefined)
      setActiveTab(action)
      return
    } else if (SectionList.includes(action)) {
      setSection(action)
      return
    }
    setSection('')
  }, [location])

  const showTab = (tab) => { history.push(Paths.showAddress(oneAddress, tab)) }
  const showStartScreen = () => { history.push(Paths.showAddress(oneAddress)) }

  // UI Rendering below
  if (!wallet.address || wallet.network !== network) {
    return <Redirect to={Paths.wallets} />
  }

  const displayTabList = tabList.filter(e => e.tab && ((!e.expert || expert) || (!e.dev || dev)) && (!e.requireNetwork || e.requireNetwork(network)))

  return (
    <>
      {!section &&
        <AnimatedSection
          title={<WalletTitle address={address} onQrCodeClick={() => showTab('qr')} onScanClick={() => showTab('scan')} />}
          tabList={displayTabList}
          activeTabKey={activeTab}
          onTabChange={key => showTab(key)}
          wide
        >
          <Warnings address={address} />
          {activeTab === 'about' && <About address={address} />}
          {activeTab === 'coins' && <Balance address={address} />}
          {activeTab === 'coins' && <ERC20Grid address={address} />}
          {activeTab === 'nft' && <NFTDashboard address={address} />}
          {activeTab === 'help' && <Recovery address={address} />}
          {activeTab === 'swap' && <Swap address={address} />}
          {activeTab === 'gift' && <Gift address={address} />}
          {activeTab === 'qr' && <QRCode address={address} name={wallet.name} />}
          {activeTab === 'scan' && <Scan address={address} />}
          {activeTab === 'call' && <Call address={address} headless />}
          {activeTab === 'sign' && <Sign address={address} headless />}
          {activeTab === 'transactions' && <TransactionViewer address={address} />}
          <Upgrade address={address} prompt={command === 'upgrade'} onClose={showStartScreen} />
          <CheckForwardState address={address} onClose={() => history.push(Paths.wallets)} />
          <CheckRoots address={address} onClose={() => history.push(Paths.wallets)} />
        </AnimatedSection>}

      {section === 'transfer' && <Send address={address} onClose={showStartScreen} />}
      {section === 'limit' && <Limit address={address} onClose={showStartScreen} />}
      {section === 'recover' && <DoRecover address={address} onClose={showStartScreen} />}
      {section === 'setRecoveryAddress' && <SetRecovery address={address} onClose={showStartScreen} />}
      {section === 'domain' && <PurchaseDomain address={address} onClose={showStartScreen} />}
      {section === 'domainTransfer' && <TransferDomain address={address} onClose={showStartScreen} />}
      {section === 'reclaim' && <Reclaim address={address} onClose={showStartScreen} />}
      {section === 'extend' && <Extend address={address} onClose={showStartScreen} />}
    </>
  )
}

export default Show
