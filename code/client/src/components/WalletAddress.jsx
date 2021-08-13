import React, { useState } from 'react'
import { Button, Space, Tooltip, Typography } from 'antd'
import util from '../util'
import { LinkOutlined, SwapOutlined } from '@ant-design/icons'

const { Text, Link } = Typography

/**
 * Determine if the current wallet name is long (more than 1 word).
 */
const isLongWalletName = (walletName) => walletName && walletName.split(' ').length > 1

/**
 * Shorten wallet address if the wallet has long name or the current view is mobile.
 */
const shouldShortenAddress = ({ walletName, isMobile }) => isLongWalletName(walletName) || isMobile

/**
 * Address to be displayed. We consider name with more than 1 word is long wallet name.
 * All new wallet should have 3 words name, old wallets are still using 1 word and will be displayed full.
 */
const displayAddress = ({ address, isMobile, wallet }) => {
  if (shouldShortenAddress({ walletName: wallet.name, isMobile })) {
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
      <Tooltip title='Explore'>
        <Link target='_blank' href={util.getNetworkExplorerUrl(address, network)} rel='noreferrer'>
          <LinkOutlined />
        </Link>
      </Tooltip>
      <Tooltip title='Switch Address Style'>
        <Link onClick={onAddressStyleSwitch}>
          <SwapOutlined />
        </Link>
      </Tooltip>
    </Space>
  )
}

/**
 * Renders the provided wallet's address in either ONE style or normal.
 * Provides the ability to copy the address and link to wallet explorer.
 */
const WalletAddress = ({ isMobile, wallet, network }) => {
  const oneAddress = util.safeOneAddress(wallet.address)

  const address = wallet.address

  const [showAddressOptions, setShowAddressOptions] = useState(false)

  const [showOneAddress, setShowOneAddress] = useState(true)

  const currentDisplayAddress = showOneAddress ? oneAddress : address

  const addressTooltipText = shouldShortenAddress({ walletName: wallet.name, isMobile }) ? currentDisplayAddress : ''

  return (
    <Space size='large' align='baseline'>
      <Tooltip title={addressTooltipText}>
        <Button
          type='text'
          style={{ color: 'rgba(0, 0, 0, 0.45)' }}
          onClick={() => setShowAddressOptions(!showAddressOptions)}
        >
          {
            displayAddress({
              address: currentDisplayAddress,
              isMobile,
              wallet
            })
          }
        </Button>
      </Tooltip>
      {
        showAddressOptions
          ? <WalletAddressOptions
              onAddressStyleSwitch={() => setShowOneAddress(!showOneAddress)}
              address={address}
              displayAddress={currentDisplayAddress}
              network={network}
            />
          : <></>
      }
    </Space>
  )
}

export default WalletAddress
