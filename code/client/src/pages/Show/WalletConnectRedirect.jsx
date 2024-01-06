import React from 'react'
import { Redirect } from 'react-router-dom'
import Paths from '../../constants/paths'

const WalletConnectRedirect = ({ address }) => {
  return <Redirect to={Paths.doAuth('walletconnect', address)} />
}
export default WalletConnectRedirect
