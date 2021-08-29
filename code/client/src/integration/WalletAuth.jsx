import { Redirect, useLocation, useRouteMatch } from 'react-router'
import Paths from '../constants/paths'
import util from '../util'
import React from 'react'
import querystring from 'query-string'
import ConnectWallet from './Connect'

const WalletAuth = () => {
  const location = useLocation()
  const match = useRouteMatch(Paths.auth)
  const { action, address: routeAddress } = match ? match.params : {}
  const oneAddress = util.safeOneAddress(routeAddress)
  const address = util.safeNormalizedAddress(routeAddress)

  const qs = querystring.parse(location.search)
  const callback = qs.callback && Buffer.from(qs.callback, 'base64').toString()
  const caller = qs.caller

  if (!action || !callback || !caller) {
    return <Redirect to={Paths.wallets} />
  }
  return (
    <>
      {action === 'connect' && <ConnectWallet caller={caller} callback={callback} />}
    </>
  )
}

export default WalletAuth
