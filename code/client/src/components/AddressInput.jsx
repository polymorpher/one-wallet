import { CloseOutlined, SearchOutlined } from '@ant-design/icons'
import { Select, Button, Tooltip, Row, Col } from 'antd'
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

  const deleteKnownAddress = useCallback((address) => {
    setAddressCallback({ value: '' })
    dispatch(walletActions.deleteKnownAddress(address))
  }, [dispatch])

  const onSearchAddress = useCallback((address) => {
    setAddressCallback({ value: address, label: address })
  }, [setAddressCallback])

  const walletsAddresses = wallets.map((wallet) => wallet.address)

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
  }, [])

  const onSelectAddress = useCallback((addressObject) => {
    const validAddress = util.normalizedAddress(addressObject.value)
    const nowInMillis = new Date().valueOf()

    if (validAddress) {
      const existingKnownAddress = knownAddresses[validAddress]

      setAddressCallback(addressObject)

      dispatch(walletActions.setKnownAddress({
        label: existingKnownAddress?.label,
        creationTime: existingKnownAddress?.creationTime || nowInMillis,
        numUsed: (existingKnownAddress?.numUsed || 0) + 1,
        network: network,
        lastUsedTime: nowInMillis,
        address: validAddress
      }))
    }
  }, [knownAddresses, setAddressCallback])

  const showSelectManualInputAddress = util.safeOneAddress(addressValue.value) &&
    !wallets[util.safeNormalizedAddress(addressValue.value)] &&
    !Object.keys(knownAddresses).includes(util.safeNormalizedAddress(addressValue.value))

  const knownAddressesOptions = Object.keys(knownAddresses).map((address) => ({
    address,
    label: knownAddresses[address].label,
    network: knownAddresses[address].network
  }))

  const buildSelectOption = ({
    address,
    key = address,
    displayDeleteButton,
    fullDisplayAddress = util.safeOneAddress(address),
    label = fullDisplayAddress,
    displayText = label ? `(${label}) ${fullDisplayAddress}` : fullDisplayAddress,
    onClick
  }) => {
    return (
      <Select.Option key={key} value={util.safeOneAddress(address)}>
        <Row gutter={16} align='left'>
          <Col span={!displayDeleteButton ? 24 : 21}>
            <Tooltip title={fullDisplayAddress}>
              <Button
                block
                type='text'
                style={{ textAlign: 'left' }}
                onClick={() => {
                  onSelectAddress({ value: fullDisplayAddress, label, key })
                  onClick && onClick({ address, value: fullDisplayAddress, label })
                }}
              >
                {displayText}
              </Button>
            </Tooltip>
          </Col>
          <Col span={3}>
            {
            displayDeleteButton
              ? (
                <Button type='text' style={{ textAlign: 'left' }} onClick={() => deleteKnownAddress(address)}>
                  <CloseOutlined />
                </Button>
                )
              : <></>
          }
          </Col>
        </Row>
      </Select.Option>
    )
  }

  return (
    <Select
      suffixIcon={<SearchOutlined />}
      placeholder='one1......'
      labelInValue
      style={{
        width: isMobile ? '100%' : 500,
        borderBottom: '1px dashed black'
      }}
      bordered={false}
      showSearch
      value={addressValue}
      onSearch={onSearchAddress}
    >
      {
        knownAddressesOptions
          .filter((knownAddress) => knownAddress.network === network && notCurrentWallet(knownAddress.address))
          .sort((knownAddress) => knownAddress.label ? -1 : 0)
          .map((knownAddress, index) => {
            const addr = util.safeOneAddress(knownAddress.address)
            const longAddressLabel = knownAddress.label ? `(${knownAddress.label}) ${addr}` : addr
            const shortenAddressLabel = knownAddress.label ? `(${knownAddress.label}) ${util.ellipsisAddress(addr)}` : util.ellipsisAddress(addr)
            const displayText = util.shouldShortenAddress({ walletName: knownAddress.label, isMobile })
              ? shortenAddressLabel
              : longAddressLabel

            // Only display actions for addresses that are not selected.
            // User's wallets addresses are not deletable.
            const displayDeleteButton = addressValue.value !== addr && !walletsAddresses.includes(knownAddress.address)

            return buildSelectOption({
              key: index,
              address: knownAddress.address,
              displayDeleteButton: displayDeleteButton,
              displayText,
              displayLabel: longAddressLabel,
              fullDisplayAddress: addr
            })
          })
      }
      {showSelectManualInputAddress && buildSelectOption({ address: addressValue.value })}
      {
        extraSelectOptions ? extraSelectOptions.map(buildSelectOption) : <></>
      }
    </Select>
  )
}

export default AddressInput
