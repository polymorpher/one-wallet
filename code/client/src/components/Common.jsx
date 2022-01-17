import { useDispatch, useSelector } from 'react-redux'
import { useState } from 'react'
import { useRandomWorker } from '../pages/Show/randomWorker'
import { useOtpState } from './OtpStack'
import { useWindowDimensions } from '../util'

export const useWallet = ({ address }) => {
  const dispatch = useDispatch()
  const wallets = useSelector(state => state.wallet)
  const wallet = wallets[address] || {}
  const network = useSelector(state => state.global.network)
  return {
    dispatch, wallets, wallet, network
  }
}

const useOpsBase = ({ address }) => {
  const { dispatch, wallets, wallet, network } = useWallet({ address })
  const [stage, setStage] = useState(-1)
  const { isMobile, os } = useWindowDimensions()
  return {
    dispatch,
    wallets,
    wallet,
    network,
    stage,
    setStage,
    isMobile,
    os
  }
}

export const useOps = ({ address }) => {
  const { dispatch, wallets, wallet, network, stage, setStage, isMobile, os } = useOpsBase({ address })
  const { resetWorker, recoverRandomness } = useRandomWorker()
  const { state: otpState } = useOtpState()

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

export const useSuperOps = ({ address }) => {
  const { dispatch, wallets, wallet, network, stage, setStage, isMobile, os } = useOpsBase({ address })
  const otpStates = new Array(6).fill(0).map(() => useOtpState().state)
  const resetOtps = () => {
    for (let i = otpStates.length - 1; i >= 0; i--) {
      otpStates[i].resetOtp(i > 0)
    }
    setStage(-1)
  }

  return {
    dispatch,
    wallets,
    wallet,
    network,
    resetOtps,
    stage,
    setStage,
    otpStates,
    isMobile,
    os
  }
}

export const useOpsCombo = ({ address }) => {
  const { dispatch, wallets, wallet, network, stage, setStage, isMobile, os } = useOpsBase({ address })
  const otpStates = new Array(6).fill(0).map(() => useOtpState().state)
  const { resetWorker, recoverRandomness } = useRandomWorker()
  const { state: otpState } = useOtpState()
  const resetOtps = () => {
    for (let i = otpStates.length - 1; i >= 0; i--) {
      otpStates[i].resetOtp(i > 0)
    }
    setStage(-1)
  }
  return {
    dispatch,
    wallets,
    wallet,
    network,
    stage,
    setStage,
    resetWorker,
    recoverRandomness,
    resetOtps,
    otpState: { doubleOtp: wallet.doubleOtp, ...otpState },
    otpStates,
    isMobile,
    os
  }
}

export const getDataFromFile = file =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => resolve(reader.result))
    reader.addEventListener('error', () => reject(reader.error))
    reader.readAsArrayBuffer(file)
  })
