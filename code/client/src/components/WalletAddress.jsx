import React, { useEffect, useState } from 'react'
import { Button, Space, Tooltip, Typography } from 'antd'
import util from '../util'
import { FieldBinaryOutlined, DeploymentUnitOutlined } from '@ant-design/icons'
const { Text, Link } = Typography

/**
 * Determine if the current wallet name is long (more than 1 word).
 */
const isLongWalletName = (walletName) => walletName && walletName.split(' ').length > 1

/**
 * Shorten wallet address if the wallet has long name or the current view is mobile.
 */
const shouldShortenAddress = ({ walletName, isMobile, shortAddress }) =>
  isLongWalletName(walletName) || isMobile || shortAddress

/**
 * Address to be displayed. We consider name with more than 1 word is long wallet name.
 * All new wallet should have 3 words name, old wallets are still using 1 word and will be displayed full.
 */
const displayAddress = ({ address, isMobile, wallet, shortAddress }) => {
  if (shouldShortenAddress({ walletName: wallet.name, isMobile, shortAddress })) {
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
const WalletAddress = ({ isMobile, wallet, network, addressOverride, shortAddress }) => {
  const oneAddress = addressOverride ? util.safeOneAddress(addressOverride) : util.safeOneAddress(wallet.address)

  const address = addressOverride ? util.safeNormalizedAddress(addressOverride) : wallet.address

  const [showAddressOptions, setShowAddressOptions] = useState(false)
  const [showAddressOptionsLocked, setShowAddressOptionsLocked] = useState(false)
  const [mouseOnOptions, setMouseOnOptions] = useState(false)
  const [mouseOnAddress, setMouseOnAddress] = useState(false)
  const [showOneAddress, setShowOneAddress] = useState(true)

  const currentDisplayAddress = showOneAddress ? oneAddress : address

  const addressTooltipText = shouldShortenAddress({ walletName: wallet.name, isMobile, shortAddress }) ? currentDisplayAddress : ''

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
              isMobile,
              wallet,
              shortAddress
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
