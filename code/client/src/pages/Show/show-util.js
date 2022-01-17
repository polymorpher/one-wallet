import * as Sentry from '@sentry/browser'
import Typography from 'antd/es/typography'
import message from '../../message'
import config from '../../config'
import util from '../../util'
import React from 'react'
import { handleAddressError } from '../../handler'
import BN from 'bn.js'
import { api } from '../../../../lib/api'
import { walletActions } from '../../state/modules/wallet'
import Paths from '../../constants/paths'
const { Text, Link } = Typography

export default {
  buildHelpers: ({ setStage, network, resetOtp, otpState, resetWorker, onSuccess }) => {
    resetOtp = resetOtp || otpState?.resetOtp
    const restart = () => {
      setStage(-1)
      resetOtp && resetOtp()
      resetWorker && resetWorker()
    }

    const onCommitError = (ex) => {
      Sentry.captureException(ex)
      console.error(ex)
      message.error('Failed to commit. Error: ' + ex.toString())
      setStage(-1)
      resetOtp && resetOtp()
      resetWorker && resetWorker()
    }

    const onCommitFailure = (error) => {
      message.error(`Cannot commit transaction. Reason: ${error}`)
      setStage(-1)
      resetOtp && resetOtp()
      resetWorker && resetWorker()
    }

    const onRevealFailure = (error) => {
      message.error(`Transaction Failed: ${error}`)
      setStage(-1)
      resetOtp && resetOtp()
      resetWorker && resetWorker()
    }

    const onRevealError = (ex) => {
      Sentry.captureException(ex)
      message.error(`Failed to finalize transaction. Error: ${ex.toString()}`)
      setStage(-1)
      resetOtp && resetOtp()
      resetWorker && resetWorker()
    }

    const onRevealAttemptFailed = (numAttemptsRemaining) => {
      message.error(`Failed to finalize transaction. Trying ${numAttemptsRemaining} more time`)
    }

    const onRevealSuccess = (txId, messages = []) => {
      setStage(3)
      if (messages.length > 0) {
        messages.forEach(m => message[m.type](<Text>{m.message}</Text>))
        if (messages.filter(m => m.abort).length > 0) {
          setTimeout(() => restart(), 1500)
          return
        }
      }

      if (config.networks[network].explorer) {
        const link = config.networks[network].explorer.replace(/{{txId}}/, txId)
        message[messages.length ? 'info' : 'success'](<Text>Done! View transaction <Link href={link} target='_blank' rel='noreferrer'>{util.ellipsisAddress(txId)}</Link></Text>, 10)
      } else {
        message[messages.length ? 'info' : 'success'](<Text>Done! Copy transaction id: <Text copyable={{ text: txId }}>{util.ellipsisAddress(txId)} </Text></Text>, 10)
      }
      setTimeout(() => restart(), 3000)
      onSuccess && onSuccess(txId)
    }

    const prepareValidation = ({ state: { otpInput, otp2Input, doubleOtp, selectedToken, transferTo, inputAmount, transferAmount }, checkAmount = true, checkDest = true, checkOtp = true, allowZero = false } = {}) => {
      let rawAmount
      const otp = util.parseOtp(otpInput)
      const otp2 = util.parseOtp(otp2Input)
      const invalidOtp = !otp
      const invalidOtp2 = doubleOtp && !otp2
      // Ensure valid address for both 0x and one1 formats
      let dest
      if (checkDest) {
        dest = util.safeExec(util.normalizedAddress, [transferTo && transferTo.value], handleAddressError)
        if (!dest) {
          return
        }
      }

      if (checkAmount) {
        if (selectedToken && util.isNFT(selectedToken)) {
          try {
            rawAmount = new BN(inputAmount)
          } catch (ex) {
            console.error(ex)
            message.error('Amount cannot be parsed')
            return
          }
          if (rawAmount.isZero() || rawAmount.isNeg()) {
            return message.error('Amount is invalid')
          }
        } else if (!transferAmount || (transferAmount.isZero() && !allowZero) || transferAmount.isNeg()) {
          return message.error('Transfer amount is invalid')
        }
      }

      if (checkOtp && (invalidOtp || invalidOtp2)) {
        message.error('Authenticator code is not valid', 10)
        resetOtp && resetOtp()
        return
      }

      return {
        otp,
        otp2,
        dest,
        invalidOtp,
        invalidOtp2,
        amount: checkAmount && (selectedToken && util.isNFT(selectedToken) ? rawAmount.toString() : transferAmount.toString())
      }
    }

    const prepareProofFailed = () => {
      setStage(-1)
      resetOtp && resetOtp()
      resetWorker && resetWorker()
    }

    const prepareProof = () => setStage(0)
    const beforeCommit = () => setStage(1)
    const afterCommit = () => setStage(2)
    return { onCommitError, onCommitFailure, onRevealFailure, onRevealError, onRevealAttemptFailed, onRevealSuccess, prepareValidation, prepareProofFailed, restart, prepareProof, beforeCommit, afterCommit }
  }
}

export const doRetire = async ({ address, network, error }) => {
  try {
    const { txId } = await api.relayer.retire({ address })
    const link = config.networks[network].explorer.replace(/{{txId}}/, txId)
    message.success(<Text>Done! View transaction <Link href={link} target='_blank' rel='noreferrer'>{util.ellipsisAddress(txId)}</Link></Text>, 10)
  } catch (ex) {
    console.error(ex)
    message.error(error || `Failed to transfer assets to recovery address. Error: ${ex.toString()}`)
  }
}

export const retryUpgrade = ({ dispatch, history, address }) => {
  dispatch(walletActions.userSkipVersion({ address, version: null }))
  history.push(Paths.showAddress(address, 'upgrade'))
}
