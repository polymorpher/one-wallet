import * as Sentry from '@sentry/browser'
import { message, Typography } from 'antd'
import config from '../../config'
import util from '../../util'
import React from 'react'
import { handleAddressError } from '../../handler'
import BN from 'bn.js'
const { Text, Link } = Typography

export default {
  buildHelpers: ({ setStage, network, resetOtp, restart }) => {
    const onCommitError = (ex) => {
      Sentry.captureException(ex)
      console.error(ex)
      message.error('Failed to commit. Error: ' + ex.toString())
      setStage(-1)
      resetOtp && resetOtp()
    }

    const onCommitFailure = (error) => {
      message.error(`Cannot commit transaction. Reason: ${error}`)
      setStage(-1)
      resetOtp && resetOtp()
    }

    const onRevealFailure = (error) => {
      message.error(`Transaction Failed: ${error}`)
      setStage(-1)
      resetOtp && resetOtp()
    }

    const onRevealError = (ex) => {
      Sentry.captureException(ex)
      message.error(`Failed to finalize transaction. Error: ${ex.toString()}`)
      setStage(-1)
      resetOtp && resetOtp()
    }

    const onRevealAttemptFailed = (numAttemptsRemaining) => {
      message.error(`Failed to finalize transaction. Trying ${numAttemptsRemaining} more time`)
    }

    const onRevealSuccess = (txId) => {
      setStage(3)
      if (config.networks[network].explorer) {
        const link = config.networks[network].explorer.replaceAll('{{txId}}', txId)
        message.success(<Text>Done! View transaction <Link href={link} target='_blank' rel='noreferrer'>{util.ellipsisAddress(txId)}</Link></Text>, 10)
      } else {
        message.success(<Text>Transfer completed! Copy transaction id: <Text copyable={{ text: txId }}>{util.ellipsisAddress(txId)} </Text></Text>, 10)
      }
      setTimeout(() => restart && restart(), 3000)
    }

    const prepareValidation = ({ state: { otpInput, otp2Input, doubleOtp, selectedToken, transferTo, inputAmount, transferAmount }, checkAmount = true, checkDest = true, checkOtp = true } = {}) => {
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
        } else if (!transferAmount || transferAmount.isZero() || transferAmount.isNeg()) {
          return message.error('Transfer amount is invalid')
        }
      }

      if (checkOtp && (invalidOtp || invalidOtp2)) {
        message.error('Google Authenticator code is not valid', 10)
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

    return { onCommitError, onCommitFailure, onRevealFailure, onRevealError, onRevealAttemptFailed, onRevealSuccess, prepareValidation }
  }
}
