import React, { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useHistory, useRouteMatch, Redirect, useLocation, matchPath } from 'react-router'
import Paths from '../constants/paths'
import WalletConstants from '../constants/wallet'
import walletActions from '../state/modules/wallet/actions'
import util from '../util'
import ONEConstants from '../../../lib/constants'

import About from './Show/About'
import Recovery from './Show/Recovery'
import DoRecover from './Show/DoRecover'
import Call from './Show/Call'
import Warnings from './Show/Warnings'

import AnimatedSection from '../components/AnimatedSection'

import { ERC20Grid } from '../components/ERC20Grid'
import { HarmonyONE } from '../components/TokenAssets'
import { NFTGrid } from '../components/NFTGrid'
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
import { message } from 'antd'
import QRCode from './Show/QRCode'
import Scan from './Show/Scan'
import NFTDashboard from './Show/NFTDashboard'
import Reclaim from './Show/Reclaim'

const tabList = [
  { key: 'coins', tab: 'Coins' },
  { key: 'nft', tab: 'Collectibles' },
  { key: 'about', tab: 'About' },
  { key: 'help', tab: 'Recover' },
  { key: 'swap', tab: 'Swap' },
  { key: 'gift', tab: 'Gift' },
  { key: 'qr' },
  { key: 'scan' }
]

const Show = () => {
  const history = useHistory()
  const location = useLocation()
  const dispatch = useDispatch()
  const dev = useSelector(state => state.wallet.dev)
  const wallets = useSelector(state => state.wallet.wallets)
  const match = useRouteMatch(Paths.show)
  const { address: routeAddress, action } = match ? match.params : {}
  const oneAddress = util.safeOneAddress(routeAddress)
  const address = util.safeNormalizedAddress(routeAddress)
  const selectedAddress = useSelector(state => state.wallet.selected)
  const wallet = wallets[address] || {}
  const [section, setSection] = useState(action)
  const network = useSelector(state => state.wallet.network)
  const [activeTab, setActiveTab] = useState('coins')
  const { temp, forwardAddress } = wallet

  useEffect(() => {
    if (!wallet) {
      return history.push(Paths.wallets)
    }
    if (address && (address !== selectedAddress)) {
      dispatch(walletActions.selectWallet(address))
    }
    const fetch = () => dispatch(walletActions.fetchBalance({ address }))
    fetch()
    const handler = setInterval(() => fetch(), WalletConstants.fetchBalanceFrequency)
    dispatch(walletActions.fetchWallet({ address }))
    return () => { clearInterval(handler) }
  }, [address])

  useEffect(() => {
    if (forwardAddress && forwardAddress !== ONEConstants.EmptyAddress && !temp) {
      dispatch(walletActions.updateWallet({ ...wallet, address: forwardAddress, forwardAddress: ONEConstants.EmptyAddress }))
      dispatch(walletActions.deleteWallet(address))
      message.success('Detected upgraded version of this wallet. Redirecting there...')
      setTimeout(() => history.push(Paths.showAddress(forwardAddress)), 500)
    }
  }, [temp, forwardAddress])

  const selectedToken = wallet?.selectedToken || HarmonyONE

  useEffect(() => {
    const m = matchPath(location.pathname, { path: Paths.show })
    const { action } = m ? m.params : {}
    if (action !== 'nft' && action !== 'transfer' && selectedToken.key !== 'one' && selectedToken.tokenType !== ONEConstants.TokenType.ERC20) {
      dispatch(walletActions.setSelectedToken({ token: null, address }))
    }
    if (tabList.find(t => t.key === action)) {
      setSection(undefined)
      setActiveTab(action)
      return
    }
    setSection(action)
  }, [location])

  const showTab = (tab) => { history.push(Paths.showAddress(oneAddress, tab)) }
  const showStartScreen = () => { history.push(Paths.showAddress(oneAddress)) }

  // UI Rendering below
  if (!wallet || wallet.network !== network) {
    return <Redirect to={Paths.wallets} />
  }

  let displayTabList = tabList.filter(e => e.tab)
  if (dev) {
    displayTabList = displayTabList.filter(e => !e.dev)
  }

  return (
    <>
      <AnimatedSection
        show={!section}
        title={<WalletTitle address={address} onQrCodeClick={() => showTab('qr')} onScanClick={() => showTab('scan')} />}
        style={{ minHeight: 320, maxWidth: 720 }}
        tabList={displayTabList}
        activeTabKey={activeTab}
        onTabChange={key => showTab(key)}
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
        <Upgrade address={address} />
      </AnimatedSection>

      <Send address={address} show={section === 'transfer'} onClose={showStartScreen} />
      <DoRecover address={address} show={section === 'recover'} onClose={showStartScreen} />
      <SetRecovery show={section === 'setRecoveryAddress'} address={address} onClose={showStartScreen} />
      <PurchaseDomain
        show={section === 'domain'}
        address={address}
        onClose={showStartScreen}
      />
      <TransferDomain
        show={section === 'domainTransfer'}
        address={address}
        onClose={showStartScreen}
      />
      <Reclaim
        show={section === 'reclaim'}
        address={address}
        onClose={showStartScreen}
      />
      {dev && <Call address={address} show={section === 'call'} onClose={showStartScreen} />}
      {dev && <Sign address={address} show={section === 'sign'} onClose={showStartScreen} />}
    </>
  )
}

export default Show
