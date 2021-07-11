import React, { useEffect, useState } from 'react'
import { render, Text } from 'ink'
import Info from './info'
import { loadWalletState, overrideWalletState, saveToMain } from './store'
import { HarmonyAddress } from '@harmony-js/crypto'
import { api } from '../../lib/api'
const SetMain = ({ name, address }) => {
  const [error, setError] = useState()
  const [wallet, setWallet] = useState()

  useEffect(() => {
    (async () => {
      // console.log(name, address)
      const { error, wallet } = await loadWalletState({ name, address })
      if (error) {
        return setError(error)
      }
      const blockchainWallet = await api.blockchain.getWallet({ address: wallet.address })
      const updatedWallet = { ...wallet, ...blockchainWallet }
      setWallet(updatedWallet)
      const { file } = await saveToMain({ address: new HarmonyAddress(wallet.address).bech32, name: wallet.name })
      const { error: error2 } = await overrideWalletState({ filename: file, state: updatedWallet })
      if (error2) {
        return setError(error2)
      }
      process.exit(0)
    })()
  }, [])
  return (
    <>
      {error && <Text color='red'>{error}</Text>}
      {!wallet && <Text>Loading wallet...</Text>}
      {wallet &&
        <>
          <Text>
          Changed main wallet to:
          </Text>
          <Info wallet={wallet} />
        </>}
    </>
  )
}

export default ({ name, address }) => {
  return render(<SetMain {...{ name, address }} />)
}
