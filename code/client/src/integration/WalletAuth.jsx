import { Redirect, useLocation, useRouteMatch } from 'react-router'
import Paths from '../constants/paths'
import util from '../util'
import React from 'react'
import querystring from 'query-string'
import ConnectWallet from './Connect'
import RequestPayment from './RequestPayment'

const WalletAuth = () => {
  const location = useLocation()
  const match = useRouteMatch(Paths.auth)
  const { action, address: routeAddress } = match ? match.params : {}
  const oneAddress = util.safeOneAddress(routeAddress)
  const address = util.safeNormalizedAddress(routeAddress)

  const qs = querystring.parse(location.search)
  const callback = qs.callback && Buffer.from(qs.callback, 'base64').toString()
  const caller = qs.caller
  const { amount, dest, from } = qs

  if (!action || !callback || !caller) {
    return <Redirect to={Paths.wallets} />
  }
  return (
    <>
      {action === 'connect' && <ConnectWallet caller={caller} callback={callback} />}
      {action === 'pay' && <RequestPayment caller={caller} callback={callback} amount={amount} dest={dest} from={from} />}
    </>
  )
}

export default WalletAuth
