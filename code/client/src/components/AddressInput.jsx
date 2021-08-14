import { SearchOutlined } from '@ant-design/icons'
import { Select } from 'antd'
import React, { useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import walletActions from '../state/modules/wallet/actions'
import util, { useWindowDimensions } from '../util'

/**
 * Renders address input that provides type ahead search for any known ONE addresses.
 * Known addresses are addresses that have been entered by user for at least once.
 * If an address is entered in none one1... format, the address will be converted and saved as one1... format.
 */
const AddressInput = ({ setAddressCallback, currentWallet, addressValue, extraSelectOptions, knownAddressKey }) => {
  const dispatch = useDispatch()

  const wallets = useSelector(state => Object.keys(state.wallet.wallets).map((k) => state.wallet.wallets[k]))

  const knownAddresses = useSelector(state => state.wallet.knownAddresses)

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

  /**
   * This is interim wallet object that uses known wallet addresses to be used to render the address selection with
   * existing wallet object. The address key is unique as knownOneAddress. Note that this will not be saved as actual wallet.
   */
  const knownWallets = (knownAddresses ? knownAddresses[knownAddressKey] || [] : []).map((knownOneAddress) => ({
    network,
    knownOneAddress
  }))

  const addressOptions = [...wallets, ...knownWallets]

  const existingKnownAddress = useCallback((oneAddress) => {
    return addressOptions.find((wallet) =>
      util.safeOneAddress(wallet.address) === oneAddress || wallet.knownOneAddress === oneAddress)
  }, [addressOptions])

  const onSelectAddress = useCallback((oneAddress) => {
    const validOneAddress = util.safeOneAddress(oneAddress)

    if (validOneAddress && !existingKnownAddress(validOneAddress)) {
      dispatch(walletActions.addKnownAddress({ knownAddressKey, oneAddress: validOneAddress }))
    }
  }, [knownAddressKey, addressOptions])

  const showSelectManualInputAddress = util.safeOneAddress(addressValue) &&
    !wallets[util.safeNormalizedAddress(addressValue)] &&
    !existingKnownAddress(addressValue)

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
        addressOptions
          .filter((wallet) => wallet.network === network && notCurrentWallet(wallet.knownOneAddress || wallet.address))
          .map((wallet, index) => {
            const addr = wallet.knownOneAddress || util.safeOneAddress(wallet.address)

            return (
              <Select.Option key={index} value={wallet.knownOneAddress || util.safeOneAddress(wallet.address)}>
                {wallet.name ? `(${wallet.name}) ` : ''}{isMobile ? util.ellipsisAddress(addr) : addr}
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
