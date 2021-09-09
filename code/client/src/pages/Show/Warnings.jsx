import { Warning } from '../../components/Text'
import util, { useWindowDimensions } from '../../util'
import ONEUtil from '../../../../lib/util'
import React from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Button, Space, Typography, Row } from 'antd'
import { walletActions } from '../../state/modules/wallet'
const { Link, Text } = Typography

const Warnings = ({ address }) => {
  const dispatch = useDispatch()
  const wallets = useSelector(state => state.wallet.wallets)
  const wallet = wallets[address] || {}
  const walletOutdated = util.isWalletOutdated(wallet)
  const { isMobile } = useWindowDimensions()

  const confirmNoteDownAddress = () => {
    dispatch(walletActions.userAcknowledgedToSaveAddress({ address }))
  }

  const displayOneAddress = util.safeOneAddress(address)

  return (
    <>
      {
        // If user not acknowledged, the message will always show to user until they acknowledged.
        // This also servers as reminder for each new wallet that user creates, so they don't accidentally forget
        // to save the wallet address for future references.
        !wallet.acknowledgedToSaveAddress &&
          <Warning info>
            <Space direction='vertical' style={{ width: '100%' }}>
              <Text>
                Please save your wallet address or get a domain name. You may need it later to restore your wallet, in case you lost the wallet.
              </Text>
              <Row justify='space-between'>
                <Text copyable>
                  {
                    isMobile ? util.ellipsisAddress(displayOneAddress) : displayOneAddress
                  }
                </Text>
                <Button shape='round' type='primary' onClick={confirmNoteDownAddress}>Dismiss</Button>
              </Row>
            </Space>
            <br />
          </Warning>
      }
      {walletOutdated && <Warning>Your wallet is too outdated. Please create a new wallet and move your friends.</Warning>}
      {util.isEmptyAddress(wallet.lastResortAddress) && <Warning>You haven't set your recovery address. Please do it as soon as possible.</Warning>}
      {ONEUtil.getVersion(wallet) === '8.0' && !wallet.doubleOtp &&
        <Warning>
          DO NOT use this version of the wallet. Funds may be unspendable and unrecoverable. Please create a new wallet. Learn more at <Link href='https://github.com/polymorpher/one-wallet/issues/72' target='_blank' rel='noreferrer'>https://github.com/polymorpher/one-wallet/issues/72</Link>
        </Warning>}
    </>
  )
}

export default Warnings
