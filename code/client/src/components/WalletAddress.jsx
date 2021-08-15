import React, { useEffect, useState } from 'react'
import { Button, Space, Tooltip, Typography } from 'antd'
import util from '../util'
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
const WalletAddress = ({ address, shorten }) => {
  const network = useSelector(state => state.wallet.network)
  const [showAddressOptions, setShowAddressOptions] = useState(false)
  const [showAddressOptionsLocked, setShowAddressOptionsLocked] = useState(false)
  const [mouseOnOptions, setMouseOnOptions] = useState(false)
  const [mouseOnAddress, setMouseOnAddress] = useState(false)
  const [showOneAddress, setShowOneAddress] = useState(true)

  const currentDisplayAddress = showOneAddress ? util.safeOneAddress(address) : util.safeNormalizedAddress(address)

  const addressTooltipText = shorten ? currentDisplayAddress : ''

  useEffect(() => {
    if (!mouseOnOptions && !mouseOnAddress && !showAddressOptionsLocked) {
      setShowAddressOptions(false)
    } else {
      setShowAddressOptions(true)
    }
  }, [mouseOnOptions, mouseOnAddress])

  return (
    <Space size='small' align='baseline'>
      <Tooltip title={addressTooltipText}>
        <Button
          type='text'
          style={{ color: 'rgba(0, 0, 0, 0.45)', minWidth: 128 }}
          onClick={() => setShowAddressOptionsLocked(!showAddressOptionsLocked)}
          onMouseEnter={() => setMouseOnAddress(true)}
          onMouseLeave={() => setTimeout(() => setMouseOnAddress(false), MOUSE_HOVER_DETECTION_DELAY)}
        >
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
