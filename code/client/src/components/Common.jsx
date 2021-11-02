import { useDispatch, useSelector } from 'react-redux'
import { useState } from 'react'
import { useRandomWorker } from '../pages/Show/randomWorker'
import { useOtpState } from './OtpStack'
import { useWindowDimensions } from '../util'

export const useWallet = ({ address }) => {
  const dispatch = useDispatch()
  const wallets = useSelector(state => state.wallet.wallets)
  const wallet = wallets[address] || {}
  const network = useSelector(state => state.wallet.network)
  return {
    dispatch, wallets, wallet, network
  }
}

export const useOps = ({ address }) => {
  const { dispatch, wallets, wallet, network } = useWallet({ address })
  const [stage, setStage] = useState(-1)
  const { resetWorker, recoverRandomness } = useRandomWorker()
  const { state: otpState } = useOtpState()
  const { isMobile, os } = useWindowDimensions()
  return {
    dispatch,
    wallets,
    wallet,
    network,
    stage,
    setStage,
    resetWorker,
    recoverRandomness,
    otpState: { doubleOtp: wallet.doubleOtp, ...otpState },
    isMobile,
    os
  }
}
