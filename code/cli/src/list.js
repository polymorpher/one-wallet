import React, { useEffect, useState } from 'react'
import { Box, render, Text } from 'ink'
import * as store from './store'
import { api } from '../../lib/api'
import { getState } from './state'
import { computeBalance } from './util'
import { HarmonyAddress } from '@harmony-js/crypto'

const ListWallets = () => {
  const { network } = getState().wallet
  const [error, setError] = useState()
  const [wallets, setWallets] = useState()
  const [balances, setBalances] = useState({})
  const [computedBalances, setComputedBalances] = useState({})
  const [price, setPrice] = useState(0)
  const [mainAddress, setMainAddress] = useState()
  useEffect(() => {
    (async () => {
      const { address: mainBech32Address, error } = await store.readMain()
      if (error) {
        return setError(error)
      }
      setMainAddress(new HarmonyAddress(mainBech32Address).checksum)
      const pointers = await store.listWallets()
      const states = await Promise.all(pointers.map(p => store.loadWalletState({ filename: p.file }).then(e => e.wallet)))
      const filteredStates = states.filter(e => e.network === network)
      setWallets(filteredStates)
      filteredStates.map(s => api.blockchain.getBalance({ address: s.address }).then(b => {
        setBalances(balances => ({ ...balances, [s.address]: b }))
      }))
      api.binance.getPrice().then(p => setPrice(p))
    })()
  }, [])
  useEffect(() => {
    const newComputedBalances = {}
    Object.keys(balances).forEach(address => {
      if (!computedBalances[address] || computedBalances[address].pending) {
        const { balance, formatted, fiat, fiatFormatted, valid } = computeBalance(balances[address], price)
        const pending = !price
        newComputedBalances[address] = { balance, formatted, fiat, fiatFormatted, valid, pending }
        // console.log(address, newComputedBalances[address])
      }
    })
    // console.log('price=', price)
    // console.log('balances=', balances)
    // console.log('Updating computed balances...', newComputedBalances)

    setComputedBalances(e => ({ ...e, ...newComputedBalances }))
  }, [price, balances])
  useEffect(() => {
    if (
      wallets &&
      Object.keys(computedBalances).length === wallets.length &&
      Object.keys(computedBalances).filter(k => computedBalances[k].pending).length === 0
    ) {
      process.exit(0)
    }
  }, [computedBalances])
  if (!wallets) {
    return <Text>Reading wallet files...</Text>
  }
  return (
    <Box flexDirection='column'>
      {error && <Text color='red'>{error}</Text>}
      <Text>{'-'.repeat(129)}</Text>
      <Box>
        <Box width={48}><Text>Address</Text></Box>
        <Text> | </Text>
        <Box width={24}><Text>Name</Text></Box>
        <Text> | </Text>
        <Box width={24}><Text>Balance</Text></Box>
        <Text> | </Text>
        <Box width={24}><Text>Estimated USD Value</Text></Box>
      </Box>
      <Text>{'-'.repeat(129)}</Text>
      {wallets.map(wallet => {
        return (
          <Box flexDirection='column' key={wallet.address}>
            <Box>
              <Box width={48}><Text>{new HarmonyAddress(wallet.address).bech32}{wallet.address === mainAddress && ' (*)'}</Text></Box>
              <Text> | </Text>
              <Box width={24}><Text>{wallet.name}</Text></Box>
              <Text> | </Text>
              <Box width={24}><Text>{computedBalances[wallet.address]?.formatted || 'Fetching...'}</Text></Box>
              <Text> | </Text>
              <Box width={24}><Text>{(price && computedBalances[wallet.address]?.fiatFormatted) || 'Fetching...'}</Text></Box>
            </Box>
          </Box>
        )
      })}
    </Box>
  )
}

export default () => {
  return render(<ListWallets />)
}
