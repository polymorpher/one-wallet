import { Warning } from '../../components/Text'
import util from '../../util'
import ONEUtil from '../../../../lib/util'
import React from 'react'
import { useSelector } from 'react-redux'
import { Typography } from 'antd'
const { Link } = Typography

const Warnings = ({ address }) => {
  const wallets = useSelector(state => state.wallet.wallets)
  const wallet = wallets[address] || {}
  const walletOutdated = util.isWalletOutdated(wallet)

  return (
    <>
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
