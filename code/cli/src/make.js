import React, { useEffect, useState } from 'react'
import { Box, render, Text, useStdout } from 'ink'
import { HarmonyAddress } from '@harmony-js/crypto'
import ONE from '../../lib/onewallet'
import Constants from './constants'
import { loadIncompleteWallet, completeWallet } from './store'
import { getState } from './state'
import { api } from '../../lib/api'
import ONEUtil from '../../lib/util'
import { stringify } from './util'

const MakeWallet = ({ lastResortAddress, otpInput }) => {
  const { network } = getState().wallet
  const [error, setError] = useState()
  const [wallet, setWallet] = useState()
  const { write } = useStdout()
  useEffect(() => {
    (async () => {
      const { state, layers, error } = await loadIncompleteWallet()
      if (error) {
        return
      }
      const { effectiveTime, slotSize, hseed, root, duration, name } = state
      const index = ONEUtil.timeToIndex({ effectiveTime, maxOperationsPerInterval: slotSize })
      const leaf = layers[0].subarray(index * 32, index * 32 + 32)
      const otp = ONEUtil.encodeNumericalOtp(parseInt(otpInput))
      const eotp = ONE.computeEOTP({ hseed: ONEUtil.hexToBytes(hseed), otp })
      const computedLeaf = ONEUtil.sha256(eotp)
      if (!ONEUtil.bytesEqual(computedLeaf, leaf)) {
        setError(`The OTP code you provided [${otpInput}] is incorrect.`)
        return
      }

      let normalizedAddress = ''
      if (lastResortAddress) {
        try {
          normalizedAddress = new HarmonyAddress(lastResortAddress).checksum
        } catch (ex) {
          setError(ex.toString())
          return
        }
      }

      const { address } = await api.relayer.create({
        root: '0x' + root,
        height: layers.length,
        interval: Constants.interval / 1000,
        t0: effectiveTime / Constants.interval,
        lifespan: duration / Constants.interval,
        slotSize,
        lastResortAddress: normalizedAddress,
        dailyLimit: ONEUtil.toFraction(Constants.defaultDailyLimit).toString()
      })
      write(`Deployed. Received contract address ${address}`)

      const wallet = {
        name,
        address,
        root,
        duration,
        slotSize,
        effectiveTime,
        lastResortAddress: normalizedAddress,
        dailyLimit: ONEUtil.toFraction(Constants.defaultDailyLimit).toString(),
        hseed,
        network,
      }
      const filename = await completeWallet({ wallet })
      write(`Wallet saved in ${filename}`)
      setWallet(wallet)
    })()
  }, [])
  if (error) {
    return <Text color='red'>{error}</Text>
  }
  const stringifiedWallet = wallet && stringify(wallet)
  return (
    <>
      {!wallet && <Text>Deploying wallet...</Text>}
      {wallet &&
        <>
          <Text>
          Wallet deployed:
          </Text>
          <Box flexDirection='column'>
            <Text>{'-'.repeat(113)}</Text>
            {
              Object.keys(stringifiedWallet).map(k => {
                return (
                  <Box key={k} flexDirection='column'>
                    <Box>
                      <Box width={30}><Text>{k} </Text></Box>
                      <Text> | </Text>
                      <Box width={80}><Text>{stringifiedWallet[k]}</Text></Box>
                    </Box>
                    <Text>{'-'.repeat(113)}</Text>
                  </Box>
                )
              })
            }
          </Box>
        </>}
    </>
  )
}

export default (args) => {
  return render(<MakeWallet {...args} />)
}
