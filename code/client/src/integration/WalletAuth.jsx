import { useLocation, useRouteMatch } from 'react-router'
import Paths from '../constants/paths'
import config from '../config'
import React, { useEffect } from 'react'
import querystring from 'query-string'
import ConnectWallet from './Connect'
import RequestPayment from './RequestPayment'
import { useDispatch } from 'react-redux'
import { globalActions } from '../state/modules/global'
import RequestCall from './RequestCall'
import AnimatedSection from '../components/AnimatedSection'
import RequestSignature from './RequestSignature'
import message from '../message'
import { Text } from '../components/Text'
import WalletConnect from './WalletConnect'

const WalletAuth = () => {
  const dispatch = useDispatch()
  const location = useLocation()
  const match = useRouteMatch(Paths.auth)
  const { action } = match ? match.params : {}

  const qs = querystring.parse(location.search)
  const callback = qs.callback && Buffer.from(qs.callback, 'base64').toString()
  const { wc, caller, network } = qs
  const { amount, dest, from, calldata } = qs
  const { message: msg, raw, duration, comment } = qs
  // if (!action || !callback || !caller) {
  //   return <Redirect to={Paths.wallets} />
  // }

  useEffect(() => {
    if (network) {
      if (!config.networks[network]) {
        message.error(`App requested invalid network: ${network}`)
      } else {
        message.success(`Switched to: ${network} (per request from ${caller})`, 10)
        dispatch(globalActions.setNetwork(network))
      }
    }
  }, [network])

  if (action === 'walletconnect') {
    // return <WalletConnect wc={wc} />
    return <></>
  }

  if (!action || !callback || !caller) {
    message.error('The app did not specify a callback, an action, or its identity. Please ask the app developer to fix it.')
    return (
      <AnimatedSection
        show
        style={{ minHeight: 320, maxWidth: 720 }}
        title='Broken App'
      >
        <Text>The app did not specify a callback, an action, or its identity. Please ask the app developer to fix it.</Text>
      </AnimatedSection>
    )
  }

  return (
    <>
      {action === 'connect' && <ConnectWallet caller={caller} callback={callback} />}
      {action === 'pay' && <RequestPayment caller={caller} callback={callback} amount={amount} dest={dest} from={from} />}
      {action === 'call' && <RequestCall caller={caller} callback={callback} amount={amount} calldata={calldata} from={from} dest={dest} />}
      {action === 'sign' && <RequestSignature caller={caller} callback={callback} messageB64Encoded={msg} commentB64Encoded={comment} raw={raw} duration={duration} from={from} />}
    </>
  )
}

export default WalletAuth
