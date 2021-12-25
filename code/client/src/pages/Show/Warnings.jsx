import { Warning } from '../../components/Text'
import util from '../../util'
import ONEUtil from '../../../../lib/util'
import React from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Button, Space, Typography, Row } from 'antd'
import { walletActions } from '../../state/modules/wallet'
import { useHistory } from 'react-router'
import Paths from '../../constants/paths'
const { Link, Text } = Typography

const Warnings = ({ address }) => {
  const history = useHistory()
  const dispatch = useDispatch()
  const wallets = useSelector(state => state.wallet)
  const wallet = wallets[address] || {}
  const walletOutdated = util.isWalletOutdated(wallet)

  const confirmNoteDownAddress = () => {
    dispatch(walletActions.userAcknowledgedToSaveAddress({ address }))
  }
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
                Tips: you can save your address as a QR code so you won't lose it
              </Text>
              <Row justify='space-between' style={{ flexWrap: 'wrap' }}>
                <Button shape='round' type='text' danger onClick={confirmNoteDownAddress}>Dismiss</Button>
                <Button shape='round' type='primary' onClick={() => history.push(Paths.showAddress(address, 'qr'))}>Save Now</Button>
              </Row>
            </Space>
            <br />
          </Warning>
      }
      {walletOutdated && <Warning>Your 1wallet is terribly outdated. Please create a new wallet and move your assets.</Warning>}
      {util.isEmptyAddress(wallet.lastResortAddress) && <Warning>You haven't set your recovery address. Please do it as soon as possible.</Warning>}
      {ONEUtil.getVersion(wallet) === '8.0' && !wallet.doubleOtp &&
        <Warning>
          DO NOT use this version of the wallet. Funds may be unspendable and unrecoverable. Please create a new wallet. Learn more at <Link href='https://github.com/polymorpher/one-wallet/issues/72' target='_blank' rel='noreferrer'>https://github.com/polymorpher/one-wallet/issues/72</Link>
        </Warning>}
    </>
  )
}

export default Warnings
