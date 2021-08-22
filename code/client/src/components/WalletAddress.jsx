import React, { useEffect, useState } from 'react'
import { Button, Space, Tooltip, Typography } from 'antd'
import util from '../util'
import WalletConstants from '../constants/wallet'
import { FieldBinaryOutlined, DeploymentUnitOutlined } from '@ant-design/icons'
import { useSelector } from 'react-redux'
const { Text, Link } = Typography

/**
 * Address to be displayed. It will be either displayed as full or shortened version.
 */
const displayAddress = ({ address, shorten }) => {
  if (shorten) {
    return util.ellipsisAddress(address)
  }

  return address
}

/**
 * Renders list of actionable options for the wallet's address.
 * - Copy address
 * - Go to wallet explorer
 * - Switch address style, one address or normal
 */
const WalletAddressOptions = ({ displayAddress, address, network, onAddressStyleSwitch }) => {
  return (
    <Space size='middle' align='baseline'>
      <Text copyable={{ text: displayAddress }} />
      <Tooltip title='Block Explorer'>
        <Link target='_blank' href={util.getNetworkExplorerUrl(address, network)} rel='noreferrer'>
          <DeploymentUnitOutlined />
        </Link>
      </Tooltip>
      <Tooltip title='Switch Address Format'>
        <Link onClick={onAddressStyleSwitch}>
          <FieldBinaryOutlined />
        </Link>
      </Tooltip>
    </Space>
  )
}

const MOUSE_HOVER_DETECTION_DELAY = 1000

/**
 * Renders the provided wallet's address in either ONE style or normal.
 * Provides the ability to copy the address and link to wallet explorer.
 */
const WalletAddress = ({ showLabel, labelOverride, address, shorten, onToggle, addressStyle }) => {
  const network = useSelector(state => state.wallet.network)
  const knownAddresses = useSelector(state => state.wallet.knownAddresses)
  const [showAddressOptions, setShowAddressOptions] = useState(false)
  const [showAddressOptionsLocked, setShowAddressOptionsLocked] = useState(false)
  const [mouseOnOptions, setMouseOnOptions] = useState(false)
  const [mouseOnAddress, setMouseOnAddress] = useState(false)
  const [showOneAddress, setShowOneAddress] = useState(true)

  const currentDisplayAddress = showOneAddress ? util.safeOneAddress(address) : util.safeNormalizedAddress(address)

  const addressTooltipText = shorten ? currentDisplayAddress : ''

  const getLabel = (address) => {
    const normalized = util.safeNormalizedAddress(address)
    if (normalized === WalletConstants.oneWalletTreasury.address) {
      return WalletConstants.oneWalletTreasury.label
    }
    return knownAddresses[normalized]?.label
  }

  useEffect(() => {
    if (!mouseOnOptions && !mouseOnAddress && !showAddressOptionsLocked) {
      setShowAddressOptions(false)
      onToggle && onToggle(false)
    } else {
      setShowAddressOptions(true)
      onToggle && onToggle(true)
    }
  }, [mouseOnOptions, mouseOnAddress])

  return (
    <Space size='small' align='baseline'>
      <Tooltip title={addressTooltipText}>
        <Button
          type='text'
          style={{ color: 'rgba(0, 0, 0, 0.45)', textAlign: 'left', ...addressStyle }}
          onClick={() => setShowAddressOptionsLocked(!showAddressOptionsLocked)}
          onMouseEnter={() => setMouseOnAddress(true)}
          onMouseLeave={() => setTimeout(() => setMouseOnAddress(false), MOUSE_HOVER_DETECTION_DELAY)}
        >
          {
            showLabel && getLabel(address) && `(${getLabel(address)}) `
          }
          {
            displayAddress({
              address: currentDisplayAddress,
              shorten
            })
          }
        </Button>
      </Tooltip>
      <Space
        onMouseEnter={() => setMouseOnOptions(true)}
        onMouseLeave={() => setTimeout(() => setMouseOnOptions(false), MOUSE_HOVER_DETECTION_DELAY)}
      >
        {showAddressOptions
          ? <WalletAddressOptions
              onAddressStyleSwitch={() => setShowOneAddress(!showOneAddress)}
              address={address}
              displayAddress={currentDisplayAddress}
              network={network}
            />
          : <></>}
      </Space>
    </Space>
  )
}

export default WalletAddress
