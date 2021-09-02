import { Redirect, useLocation, useRouteMatch } from 'react-router'
import Paths from '../constants/paths'
import util from '../util'
import config from '../config'
import React, { useEffect } from 'react'
import querystring from 'query-string'
import ConnectWallet from './Connect'
import RequestPayment from './RequestPayment'
import { useDispatch } from 'react-redux'
import walletActions from '../state/modules/wallet/actions'
import { message } from 'antd'
import RequestCall from './RequestCall'

const WalletAuth = () => {
  const dispatch = useDispatch()
  const location = useLocation()
  const match = useRouteMatch(Paths.auth)
  const { action, address: routeAddress } = match ? match.params : {}
  const oneAddress = util.safeOneAddress(routeAddress)
  const address = util.safeNormalizedAddress(routeAddress)

  const qs = querystring.parse(location.search)
  const callback = qs.callback && Buffer.from(qs.callback, 'base64').toString()
  const caller = qs.caller
  const network = qs.network
  const { amount, dest, from, calldata } = qs

  if (!action || !callback || !caller) {
    return <Redirect to={Paths.wallets} />
  }

  useEffect(() => {
    if (network) {
      if (!config.networks[network]) {
        message.error(`App requested invalid network: ${network}`)
      } else {
        message.success(`Switched to: ${network} (per request from ${caller})`, 10)
        dispatch(walletActions.setNetwork(network))
      }
    }
  }, [network])

  return (
    <>
      {action === 'connect' && <ConnectWallet caller={caller} callback={callback} />}
      {action === 'pay' && <RequestPayment caller={caller} callback={callback} amount={amount} dest={dest} from={from} />}
      {action === 'call' && <RequestCall caller={caller} callback={callback} amount={amount} calldata={calldata} from={from} dest={dest} />}
    </>
  )
}

export default WalletAuth
