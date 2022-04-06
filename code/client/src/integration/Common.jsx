import { AverageRow } from '../components/Grid'
import Button from 'antd/es/button'
import Col from 'antd/es/col'
import Row from 'antd/es/row'
import Select from 'antd/es/select'
import Space from 'antd/es/space'
import Tooltip from 'antd/es/tooltip'
import Typography from 'antd/es/typography'
import WalletAddress from '../components/WalletAddress'
import SearchOutlined from '@ant-design/icons/SearchOutlined'
import util from '../util'
import ONEUtil from '../../../lib/util'
import React, { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import walletActions from '../state/modules/wallet/actions'
const { Text, Paragraph } = Typography

export const WALLET_OUTDATED_DISABLED_TEXT = 'This wallet cannot be used for this purpose. It might be too old. Please upgrade or use a wallet with a newer version'

export const WalletSelector = ({ from, onAddressSelected, filter = e => e, disabledText, useHex, showOlderVersions }) => {
  const dispatch = useDispatch()
  const network = useSelector(state => state.global.network)
  const wallets = useSelector(state => state.wallet)
  from = util.safeNormalizedAddress(from)
  const selectedWallet = from && wallets[from]
  const buildAddressObject = wallet => wallet && wallet.address ? ({ value: wallet.address, label: `(${wallet.name}) ${util.ellipsisAddress(useHex ? wallet.address : util.safeOneAddress(wallet.address))}` }) : {}

  useEffect(() => {
    if (from) {
      console.log(`Checking ${from}`)
    }
    if (from && !util.isValidWallet(wallets[from])) {
      console.log(`${from} is not a valid wallet. Looking for upgraded version`)
      const upgradedWallet = Object.keys(wallets).map(e => wallets[e]).find(w => util.isUpgradedFrom(w, from) && w.network === network)
      if (upgradedWallet) {
        console.log('Found upgraded wallet', upgradedWallet.address)
        const tempWallet = {
          ...upgradedWallet,
          address: from,
          temp: upgradedWallet.effectiveTime + upgradedWallet.duration,
        }
        onAddressSelected && onAddressSelected(buildAddressObject(tempWallet))
        dispatch(walletActions.updateWallet(tempWallet))
      }
    }
  }, [from, wallets, network])

  return (
    <>
      {from && !selectedWallet &&
        <AverageRow>
          <Space direction='vertical'>
            <Paragraph>The app wants you to use your 1wallet at this address:</Paragraph>
            <Paragraph> <WalletAddress addressStyle={{ padding: 0 }} useHex={useHex} showLabel address={from} /></Paragraph>
            <Paragraph>However, you do not have that 1wallet address in this device. Please go back to the app, and choose an 1wallet address that you own. If you do own that 1wallet address but it is not appearing in your wallets, you need restore the wallet first using "Restore" feature with your Google Authenticator.</Paragraph>
          </Space>
        </AverageRow>}
      {from && selectedWallet &&
        <AverageRow>
          <Space direction='vertical'>
            <Paragraph>Using {selectedWallet.temp && 'an old wallet address'} </Paragraph>
            <Paragraph><WalletAddress addressStyle={{ padding: 0 }} useHex={useHex} showLabel address={from} /></Paragraph>
          </Space>
        </AverageRow>}
      {!from && (
        <>
          <AverageRow>
            <Text>Select a wallet you want to use:</Text>
          </AverageRow>
          <WalletSelectorBase onAddressSelected={onAddressSelected} filter={filter} disabledText={disabledText} useHex={useHex} showOlderVersions={showOlderVersions} />
        </>)}
    </>
  )
}

const WalletSelectorBase = ({
  onAddressSelected, filter = e => e, disabledText, useHex, showOlderVersions, style = {}, selectStyle = {
    width: '100%',
    borderBottom: '1px dashed black'
  }
}) => {
  const network = useSelector(state => state.global.network)
  const wallets = useSelector(state => state.wallet)
  const walletList = Object.keys(wallets).map(e => wallets[e]).filter(e => e.network === network && (showOlderVersions ? (!e.temp || !util.isEmptyAddress(e.forwardAddress)) : !e.temp))
  const buildAddressObject = wallet => wallet && wallet.address ? ({ value: wallet.address, label: `(${wallet.name}) ${util.ellipsisAddress(useHex ? wallet.address : util.safeOneAddress(wallet.address))}` }) : {}
  const firstEligibleWallet = walletList.find(filter)
  const defaultUserAddress = firstEligibleWallet ? buildAddressObject(firstEligibleWallet) : {}
  const [selectedAddress, setSelectedAddress] = useState(defaultUserAddress)

  useEffect(() => {
    onAddressSelected && onAddressSelected(selectedAddress)
  }, [selectedAddress])

  return (
    <AverageRow style={style}>
      <Select
        suffixIcon={<SearchOutlined />}
        placeholder={useHex ? '0x...' : 'one1......'}
        labelInValue
        bordered={false}
        showSearch
        style={selectStyle}
        value={selectedAddress}
        onBlur={() => {}}
        onSearch={() => {}}
      >
        {walletList.map(wallet => {
          const { address, name } = wallet
          const displayAddress = useHex ? address : util.safeOneAddress(address)
          const versionInfo = wallet.temp ? ` (v${ONEUtil.getVersion(wallet)}) ` : ' '
          const displayText = `(${name})${versionInfo}${util.ellipsisAddress(displayAddress)}`
          const enabled = filter(wallet)
          return (
            <Select.Option key={displayText} value={displayText} style={{ padding: 0 }}>
              <Row align='left'>
                <Col span={24}>
                  <Tooltip title={(!enabled && disabledText) ? disabledText + ' ' + displayAddress : displayAddress}>
                    <Button
                      block
                      type='text'
                      style={{ textAlign: 'left', height: '50px', opacity: enabled ? 1.0 : 0.5 }}
                      onClick={() => {
                        setSelectedAddress({ value: address, label: displayText })
                      }}
                      disabled={!enabled}
                    >
                      {displayText}
                    </Button>
                  </Tooltip>
                </Col>
              </Row>
            </Select.Option>
          )
        })}
      </Select>
    </AverageRow>
  )
}

export const WalletSelectorV2 = ({ ...args }) => {
  return <WalletSelectorBase {...args} />
}
