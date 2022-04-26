// eslint-disable-next-line no-unused-vars
import React, { useEffect, useState } from 'react'
// import styled from 'styled-components'
import PageHeader from 'antd/es/page-header'
import Select from 'antd/es/select'
import Divider from 'antd/es/divider'
import Modal from 'antd/es/modal'
import Input from 'antd/es/input'
import Button from 'antd/es/button'
import Space from 'antd/es/space'
import Switch from 'antd/es/switch'
import Typography from 'antd/es/typography'
import ConfigProvider from 'antd/es/config-provider'
import { useRouteMatch, useHistory } from 'react-router'
import { titleCase } from 'title-case'
import { useSelector, useDispatch } from 'react-redux'
import SearchOutlined from '@ant-design/icons/SearchOutlined'
import LockOutlined from '@ant-design/icons/LockOutlined'
import CloseOutlined from '@ant-design/icons/CloseOutlined'
import SettingOutlined from '@ant-design/icons/SettingOutlined'
import config from '../config'
import Paths, { UrlCategory } from '../constants/paths'
import util, { Breakpoints, useWindowDimensions } from '../util'
import { Hint } from './Text'
import WalletAddress from './WalletAddress'
import { globalActions } from '../state/modules/global'
import { StatsInfoV2 } from './StatsInfo'
import { useTheme, getColorPalette } from '../theme'
import { WalletSelectorV2 } from '../integration/Common'
import { SecondaryButton } from '../components/Buttons'
const { Text, Link } = Typography

// const SelectorLabel = styled.span`
//   margin: 16px;
// `
const NetworkSelector = () => {
  const networkId = useSelector(state => state.global.network)
  const dispatch = useDispatch()
  const networks = config.networks
  const onChange = (v) => {
    dispatch(globalActions.setNetwork(v))
  }
  return (
    <>
      {/* <SelectorLabel>Network</SelectorLabel> */}
      <Select style={{ width: 160 }} bordered={false} value={networkId} onChange={onChange}>
        {Object.keys(networks).map(k => {
          return <Select.Option key={k} value={k}>{networks[k].name} </Select.Option>
        })}

      </Select>
    </>
  )
}

const RelayerSelector = () => {
  const relayer = useSelector(state => state.global.relayer)
  const [input, setInput] = useState('')
  const dispatch = useDispatch()
  const relayers = config.relayers
  const onChange = (v) => {
    dispatch(globalActions.setRelayer(v))
  }
  return (
    <>
      {/* <SelectorLabel>Relayer</SelectorLabel> */}
      <Select
        suffixIcon={<SearchOutlined />}
        style={{ width: 200 }} dropdownMatchSelectWidth bordered={false} showSearch onChange={onChange}
        value={relayer}
        onSearch={(v) => setInput(v)}
      >
        {Object.keys(relayers).map(k => {
          return <Select.Option key={k} value={k}>{relayers[k].name} </Select.Option>
        })}
        {input && <Select.Option key={input} value={input}>{input}</Select.Option>}
      </Select>
    </>
  )
}

const SecretSettings = ({ visible, onClose }) => {
  const dispatch = useDispatch()
  const relayerSecret = useSelector(state => state.global.relayerSecret)
  const [secret, setSecret] = useState(relayerSecret)
  const onSubmit = () => {
    dispatch(globalActions.setRelayerSecret(secret))
    onClose && onClose()
  }
  return (
    <Modal title='Relayer password' visible={visible} onOk={onSubmit} onCancel={onClose}>
      <Space direction='vertical'>
        <Text>If your relayer is password protected, provide it here</Text>
        <Input style={{ marginBottom: 24 }} value={secret} onChange={({ target: { value } }) => setSecret(value)} />
        <Text type='secondary'>What is a relayer?</Text>
        <Text type='secondary'>You need to pay for gas to do stuff on blockchain. Relayers are paying on your behalf. For testing, we are providing a relayer for free.</Text>
        <Text type='secondary'>You may also set up your own relayer using <Link target='_blank' href='https://github.com/polymorpher/one-wallet/tree/master/code/relayer' rel='noreferrer'>our code on Github</Link></Text>
      </Space>
    </Modal>
  )
}

const WalletHeader = () => {
  const { isMobile } = useWindowDimensions()
  const dev = useSelector(state => state.global.dev)
  const history = useHistory()
  const match = useRouteMatch('/:action/:address?')
  const { action, address: routeAddress } = match ? match.params : {}
  const address = routeAddress && util.safeNormalizedAddress(routeAddress) || ''
  const wallets = useSelector(state => state.wallet)
  const wallet = wallets[address] || {}
  const subtitle = address && <>{wallet.name && <Hint style={{ marginRight: 32 }}>{wallet.name}</Hint>}<WalletAddress address={address} shorten={false} alwaysShowOptions /></>
  const [settingsVisible, setSettingsVisible] = useState(false)
  const [relayerEditVisible, setRelayerEditVisible] = useState(false)
  return (
    <PageHeader
      style={{ background: '#ffffff', padding: isMobile ? 8 : undefined }}
      onBack={action && (() => history.goBack())}
      title={!isMobile && titleCase(action || '')}
      subTitle={!isMobile && <Hint>{subtitle}</Hint>}
      extra={[
        dev && <Button key='toggle' shape='circle' icon={relayerEditVisible ? <CloseOutlined /> : <SettingOutlined />} onClick={() => setRelayerEditVisible(!relayerEditVisible)} />,
        dev && relayerEditVisible &&
          <Space size='small' key='relayer'>
            <Button shape='circle' icon={<LockOutlined />} onClick={() => setSettingsVisible(true)} />
            <RelayerSelector />
            <Divider type='vertical' />
          </Space>,
        <NetworkSelector key='network' />,
        <SecretSettings key='settings' visible={settingsVisible} onClose={() => setSettingsVisible(false)} />
      ]}
    />
  )
}

export const WalletHeaderV2 = () => {
  const dispatch = useDispatch()
  const history = useHistory()
  const { isMobile, width } = useWindowDimensions()
  const theme = useTheme()
  const dev = useSelector(state => state.global.dev)
  const selectedAddress = useSelector(state => state.global.selectedWallet)
  const wallets = useSelector(state => state.wallet)
  const network = useSelector(state => state.global.network)
  const networkWallets = util.filterNetworkWallets(wallets, network)
  const matchedWallet = networkWallets.filter(w => w.address === selectedAddress)[0]
  const [settingsVisible, setSettingsVisible] = useState(false)
  const [relayerEditVisible, setRelayerEditVisible] = useState(false)
  const { primaryBgColor, secondaryBgColor, secondaryBorderColor } = getColorPalette(theme)
  const match = useRouteMatch(Paths.matchStructure)
  const { category } = match ? match.params : {}

  const onAddressSelected = (e) => {
    if (category !== UrlCategory.WALLET) {
      history.push(Paths.showAddress(e.value))
    }
  }

  const onThemeChange = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark'
    ConfigProvider.config({
      theme: getColorPalette(newTheme),
    })
    dispatch(globalActions.setUiTheme(newTheme))
  }

  return (
    <div
      style={{
        background: primaryBgColor,
        padding: isMobile ? 8 : 24,
        alignItems: 'center',
        display: 'flex',
        justifyContent: 'space-around',
        flexWrap: 'wrap',
        gap: '16px'
      }}
    >
      {/* Wallet selector + send + receive if wallet exists */}
      {matchedWallet && (
        <div style={{ display: 'flex', height: '100%', alignItems: 'center', gap: '8px' }}>
          <WalletSelectorV2 onAddressSelected={onAddressSelected} filter={e => e.majorVersion >= 10} useHex style={{ background: secondaryBgColor, border: `1px solid ${secondaryBorderColor}`, margin: '0 4px', padding: '4px 0', borderRadius: '16px' }} selectStyle={{}} />
          <SecondaryButton onClick={() => history.push(Paths.showAddress(selectedAddress, 'transfer'))} style={{ padding: '8px 16px', height: '100%', borderRadius: '15px' }}>Send</SecondaryButton>
          <SecondaryButton onClick={() => history.push(Paths.showAddress(selectedAddress, 'qr'))} style={{ padding: '8px 16px', height: '100%', borderRadius: '15px' }}>Receive</SecondaryButton>
        </div>)}
      {width >= Breakpoints.LARGE && <StatsInfoV2 />}
      <div style={{ display: 'flex', height: '100%', alignItems: 'center' }}>
        {dev && <Button key='toggle' shape='circle' icon={relayerEditVisible ? <CloseOutlined /> : <SettingOutlined />} onClick={() => setRelayerEditVisible(!relayerEditVisible)} />}
        {dev && relayerEditVisible &&
          <Space size='small' key='relayer'>
            <Button shape='circle' icon={<LockOutlined />} onClick={() => setSettingsVisible(true)} />
            <RelayerSelector />
            <Divider type='vertical' />
          </Space>}
        <NetworkSelector key='network' />
      </div>
      <SecretSettings key='settings' visible={settingsVisible} onClose={() => setSettingsVisible(false)} />
      <Switch checkedChildren='Dark' unCheckedChildren='Light' onChange={onThemeChange} checked={theme === 'dark'} />
    </div>
  )
}

export default WalletHeader
