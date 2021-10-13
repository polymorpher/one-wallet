import React from 'react'
import AnimatedSection from '../components/AnimatedSection'
import { Typography, Divider, Button, Space, message } from 'antd'
import { useSelector } from 'react-redux'
const { Text, Link, Title } = Typography

const Tools = () => {
  const dev = useSelector(state => state.wallet.dev)
  const wallets = useSelector(state => state.wallet.wallets)
  const addHarmonyNetwork = async () => {
    if (!window.ethereum || !window.ethereum.isMetaMask) {
      message.error('MetaMask not found')
      return
    }
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x63564C40' }],
      })
      message.success('Switched to Harmony Network on MetaMask')
    } catch (ex) {
      console.error(ex)
      if (ex.code !== 4902) {
        message.error('Failed to switch to Harmony network:' + ex.toString())
        return
      }
      try {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: '0x63564C40', // A 0x-prefixed hexadecimal string
            chainName: 'Harmony Mainnet Shard 0',
            nativeCurrency: {
              name: 'ONE',
              symbol: 'ONE',
              decimals: 18
            },
            rpcUrls: ['https://api.harmony.one'],
            blockExplorerUrls: ['https://www.harmony.one/']
          }]
        })
        message.success('Added Harmony Network on MetaMask')
      } catch (ex2) {
        message.error('Failed to add Harmony network:' + ex.toString())
      }
    }
  }

  const dumpState = () => {
    const url = window.URL.createObjectURL(new Blob([JSON.stringify(wallets)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.style.display = 'none'
    a.href = url
    // the filename you want
    a.download = '1wallet-state-dump.json'
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
  }

  return (
    <AnimatedSection show style={{ minHeight: 320, maxWidth: 720 }}>
      <Space direction='vertical' style={{ width: '100%' }}>
        <Title level={3}>MetaMask</Title>
        <Button type='primary' shape='round' onClick={addHarmonyNetwork}>Switch to Harmony Network</Button>
        <Divider />
        <Title level={3}>Harmony Safe</Title>
        <Button type='primary' shape='round' href='http://multisig.harmony.one' target='_blank'>Open Harmony MultiSig</Button>
        {dev &&
          <>
            <Divider />
            <Title level={3}>Dev</Title>
            <Button type='primary' shape='round' onClick={dumpState}>Dump Wallet States</Button>
          </>}
      </Space>
    </AnimatedSection>
  )
}

export default Tools
