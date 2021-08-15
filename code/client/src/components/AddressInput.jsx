import { SearchOutlined } from '@ant-design/icons'
import { Select, Space } from 'antd'
import React, { useCallback, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import walletActions from '../state/modules/wallet/actions'
import util, { useWindowDimensions } from '../util'

/**
 * Renders address input that provides type ahead search for any known addresses.
 * Known addresses are addresses that have been entered by user for at least once.
 */
const AddressInput = ({ setAddressCallback, currentWallet, addressValue, extraSelectOptions }) => {
  const dispatch = useDispatch()

  const wallets = useSelector(state => Object.keys(state.wallet.wallets).map((k) => state.wallet.wallets[k]))

  const knownAddresses = useSelector(state =>
    state.wallet.knownAddresses || {}
  )

  const network = useSelector(state => state.wallet.network)

  const { isMobile } = useWindowDimensions()

  const onChangeAddress = useCallback((address) => {
    setAddressCallback(address)
  }, [setAddressCallback])

  /**
   * Determines if the input wallet wallet is for the current wallet. Applicable for existing wallet management.
   */
  const notCurrentWallet = useCallback((inputWalletAddress) =>
    !currentWallet || currentWallet?.address !== inputWalletAddress,
  [currentWallet])

  useEffect(() => {
    const existingKnownAddresses = Object.keys(knownAddresses)
      .map((address) => ({
        address,
        network: knownAddresses[address]?.network
      }))

    const walletsNotInKnownAddresses = wallets.filter((wallet) =>
      !existingKnownAddresses.find((knownAddress) =>
        knownAddress.address === wallet.address && knownAddress.network === wallet.network)
    )

    // Init the known address entries for existing wallets.
    walletsNotInKnownAddresses.forEach((wallet) => {
      dispatch(walletActions.setKnownAddress({
        label: wallet.name,
        address: wallet.address,
        network: wallet.network,
        creationTime: wallet.effectiveTime,
        numUsed: 0
      }))
    })
  }, [knownAddresses, wallets, dispatch])

  const onSelectAddress = useCallback((address) => {
    const validAddress = util.normalizedAddress(address)
    const nowInMillis = new Date().valueOf()

    if (validAddress) {
      const existingKnownAddress = knownAddresses[validAddress]

      dispatch(walletActions.setKnownAddress({
        label: existingKnownAddress?.label,
        creationTime: existingKnownAddress?.creationTime || nowInMillis,
        numUsed: (existingKnownAddress?.numUsed || 0) + 1,
        network: network,
        lastUsedTime: nowInMillis,
        address: validAddress
      }))
    }
  }, [knownAddresses])

  const showSelectManualInputAddress = util.safeOneAddress(addressValue) &&
    !wallets[util.safeNormalizedAddress(addressValue)] &&
    !Object.keys(knownAddresses).includes(util.safeNormalizedAddress(addressValue))

  const knownAddressesOptions = Object.keys(knownAddresses).map((address) => ({
    address,
    label: knownAddresses[address].label,
    network: knownAddresses[address].network
  }))

  return (
    <Select
      suffixIcon={<SearchOutlined />}
      placeholder='one1......'
      style={{
        width: isMobile ? '100%' : 500,
        borderBottom: '1px dashed black'
      }}
      bordered={false}
      showSearch
      value={addressValue}
      onChange={onChangeAddress}
      onSearch={onChangeAddress}
      onSelect={onSelectAddress}
    >
      {
        knownAddressesOptions
          .filter((knownAddress) => knownAddress.network === network && notCurrentWallet(knownAddress.address))
          .map((knownAddress, index) => {
            const addr = util.safeOneAddress(knownAddress.address)

            return (
              <Select.Option key={index} value={util.safeOneAddress(knownAddress.address)}>
                <Space size='middle' align='baseline'>
                  {knownAddress.label ? `(${knownAddress.label}) ` : ''}{isMobile ? util.ellipsisAddress(addr) : addr}
                </Space>
              </Select.Option>
            )
          })
      }
      {
        showSelectManualInputAddress
          ? <Select.Option key='address-value' value={addressValue}>{addressValue}</Select.Option>
          : <></>
      }
      {
        extraSelectOptions ? extraSelectOptions.map((SelectOption) => SelectOption) : <></>
      }
    </Select>
  )
}

export default AddressInput
