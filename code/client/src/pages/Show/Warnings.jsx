import { Warning } from '../../components/Text'
import util from '../../util'
import ONEUtil from '../../../../lib/util'
import React from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Button, Space, Typography } from 'antd'
import { walletActions } from '../../state/modules/wallet'
const { Link, Text } = Typography

const Warnings = ({ address }) => {
  const dispatch = useDispatch()
  const wallets = useSelector(state => state.wallet.wallets)
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
        wallet.acknowledgedToSaveAddress
          ? <></>
          : (
            <>
              <Warning style={{ backgroundColor: '#fffbe6' }}>
                <Space direction='vertical'>
                  <Text>
                    Please note down your wallet address for future reference (e.g. restore)
                  </Text>
                  <Text copyable>{util.safeOneAddress(address)}</Text>
                  <Button style={{ float: 'right' }} shape='round' type='primary' onClick={confirmNoteDownAddress}>OK</Button>
                </Space>
              </Warning>
              <br />
            </>
            )
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
