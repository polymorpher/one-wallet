import React, { useEffect, useState } from 'react'
import { Box, render, Text, useStdout } from 'ink'
import { HarmonyAddress } from '@harmony-js/crypto'
import ONE from '../../lib/onewallet'
import { loadWalletState, loadWalletLayers } from './store'
import { getState } from './state'
import { api } from '../../lib/api'
import { toBalance } from './util'
import { SmartFlows } from '../../lib/api/flow'
import Spinner from 'ink-spinner'
import config from './config'

const DoSend = ({ destInput, amountInput, otpInput, name, address }) => {
  const { network } = getState().wallet
  const [error, setError] = useState()
  const [success, setSuccess] = useState()
  const { write } = useStdout()
  const [wallet, setWallet] = useState()

  const [stage, setStage] = useState(0)
  useEffect(() => {
    (async () => {
      // console.log(name, address)
      const { error: error1, wallet } = await loadWalletState({ name, address })
      if (error1) {
        return setError(error1)
      }
      if (wallet.network !== network) {
        return setError(`Wallet is on network [${wallet.network}] but you specified network [${network}]`)
      }
      const { error: error2, layers } = await loadWalletLayers({ name, address })
      if (error2) {
        return setError(error2)
      }
      setWallet(wallet)
      const { balance: amount } = toBalance(amountInput)
      if (!amount) {
        return setError('Amount is invalid: ' + amountInput)
      }
      const otp = parseInt(otpInput)
      if (isNaN(otp)) {
        return setError('Authenticator code is invalid: ' + otpInput)
      }
      let dest
      try {
        dest = new HarmonyAddress(destInput).checksum
      } catch (ex) {
        return setError(`Destination address is invalid: ${destInput}`)
      }
      // console.log({ dest, amount, otp, otpInput, destInput, amountInput, wallet })
      const onCommitError = (ex) => {
        setError('Failed to commit. Error: ' + ex.toString())
        process.exit(1)
      }
      const onCommitFailure = (error) => {
        setError(`Cannot commit transaction. Reason: ${error}`)
        process.exit(1)
      }
      const onRevealFailure = (error) => {
        setError(`Transaction Failed: ${error}`)
        process.exit(1)
      }
      const onRevealError = (ex) => {
        setError(`Failed to finalize transaction. Error: ${ex.toString()}`)
        process.exit(1)
      }
      const onRevealAttemptFailed = (numAttemptsRemaining, ex) => {
        setError(`Failed to finalize transaction. Trying ${numAttemptsRemaining} more time. Error: ${ex.toString()}`)
      }

      const onRevealSuccess = (txId) => {
        setStage(3)
        setError(null)
        if (config.networks[network].explorer) {
          const link = config.networks[network].explorer.replace('{{txId}}', txId)
          setSuccess(`Done! View transaction: ${link}`)
        } else {
          setSuccess(`Done! Transaction id: ${txId}`)
        }
      }
      SmartFlows.commitReveal({
        wallet,
        layers,
        otp,
        commitHashGenerator: ONE.computeTransferHash,
        commitHashArgs: { dest, amount: amount.toString() },
        beforeCommit: () => setStage(1),
        afterCommit: () => setStage(2),
        onCommitError,
        onCommitFailure,
        revealAPI: api.relayer.revealTransfer,
        revealArgs: { dest, amount: amount.toString() },
        onRevealFailure,
        onRevealError,
        onRevealAttemptFailed,
        onRevealSuccess,
        messager: {
          error: (error) => setError(error),
          warning: (warning) => write(warning + '\n')
        }
      })
    })()
  }, [])
  return (
    <Box flexDirection='column'>
      {wallet && <Text>Wallet: {wallet.name} | {new HarmonyAddress(wallet.address).bech32}</Text>}
      <Text>Sending funds...</Text>
      {error && <Box borderStyle='single'><Text color='red'>{error}</Text></Box>}
      <Box margin={1} flexDirection='column'>
        <Text color={stage === 0 ? 'yellow' : (stage < 0 ? 'grey' : 'green')}>{stage === 0 && <Spinner type='dots' />} Preparing signatures</Text>
        <Text color={stage === 1 ? 'yellow' : (stage < 1 ? 'grey' : 'green')}>{stage === 1 && <Spinner type='dots' />} Locking-in operation </Text>
        <Text color={stage < 2 ? 'grey' : 'green'}>{stage === 2 && <Spinner type='dots' />} Submitting Proof</Text>
      </Box>
      {success && <Box borderStyle='single'><Text color='green'>{success}</Text></Box>}
    </Box>
  )
}

export default ({ destInput, amountInput, otpInput, name, address }) => {
  return render(<DoSend {...{ destInput, amountInput, otpInput, name, address }} />)
}
