import React, { useEffect, useState } from 'react'
import { render, Text } from 'ink'
import Info from './info'
import { loadWalletState, saveToMain } from './store'
import { HarmonyAddress } from '@harmony-js/crypto'

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

      setWallet(wallet)
      await saveToMain({ address: new HarmonyAddress(wallet.address).bech32, name: wallet.name })
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
