import React, { useEffect, useState } from 'react'
import AnimatedSection from '../../components/AnimatedSection'
import { Hint, InputBox, Paragraph, Text } from '../../components/Text'
import AddressInput from '../../components/AddressInput'
import api from '../../api'
import message from '../../message'
import detectEthereumProvider from '@metamask/detect-provider'
import Button from 'antd/es/button'
import util from '../../util'
import Divider from 'antd/es/divider'
import Space from 'antd/es/space'
import { Spacer } from '../../components/Layout'
import { getErc1155Balances, getErc721Assets } from '../../api/explorer'
import Table from 'antd/es/table'
import WalletAddress from '../../components/WalletAddress'
import CheckOutlined from '@ant-design/icons/CheckOutlined'

const Web3 = api.Web3

const RescueNFT = () => {
  const [inputAddress, setInputAddress] = useState({ value: '', label: '' })
  const [destAddress, setDestAddress] = useState('')
  const [privateKey, setPrivateKey] = useState('')
  const [erc721s, setErc721s] = useState([])
  const [erc1155s, setErc1155s] = useState([])
  const [web3, setWeb3] = useState(api.web3())
  const [keyMatch, setKeyMatch] = useState(null)
  const [selectedToken, setSelectedToken] = useState({ tokenAddress: '', tokenID: '' })

  async function init () {
    const provider = await detectEthereumProvider()
    const web3 = new Web3(provider)
    setWeb3(web3)
    return { web3, provider }
  }

  const connect = async () => {
    let web3, provider
    try {
      ({ web3, provider } = await init())
    } catch (ex) {
      console.error(ex)
      message.error('Cannot detect wallet')
      return
    }
    if (!web3) {
      message.error('Wallet not found')
      return
    }
    try {
      const ethAccounts = await provider.request({ method: 'eth_requestAccounts' })
      setDestAddress(ethAccounts[0])
      const chainInfo = api.blockchain.getChainInfo()
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x' + Number(chainInfo.chainId).toString(16) }],
        })
        message.success(`Switched MetaMask to network: ${chainInfo.activeNetwork}`)
      } catch (ex) {
        console.error(ex)
        if (ex.code !== 4902) {
          message.error(`Failed to switch to network ${chainInfo.activeNetwork}: ${ex.message}`)
          return
        }
        message.error('Please use the tool to add Harmony network to MetaMask first')
      }

      window.ethereum.on('accountsChanged', accounts => setDestAddress(accounts[0]))
      window.ethereum.on('networkChanged', networkId => { init() })
    } catch (ex) {
      message.error('Failed to connect wallet')
      console.error(ex)
    }
  }

  const sendFund = async () => {
    const tx = {
      from: destAddress,
      to: inputAddress.value,
      value: util.toBalance(1.0).balance.toString(),
      gasPrice: 100
    }
    // console.log(tx)
    try {
      const hash = await web3.eth.sendTransaction(tx)
      console.log(`Fund sent, txHash: ${hash}`)
      const receipt = await tryRescue()
      console.log('Rescue success, receipt', receipt)
    } catch (ex) {
      message.error(`Error sending funds and rescue: ${ex.toString()}`)
    }
  }

  const tryRescue = async () => {
    if (!selectedToken.tokenAddress) {
      message.error('No NFT selected')
      return
    }
    const w3 = api.web3()
    const key = privateKey.startsWith('0x') ? privateKey : '0x' + privateKey
    const account = w3.eth.privateKeyToAccount(key)
    try {
      w3.eth.accounts.wallet.add(account)
      const contract = await api.tokens.getTokenContract[selectedToken.type.toLowerCase()](selectedToken.tokenAddress)
      let receipt
      if (selectedToken.type.toLowerCase() === 'erc721') {
        receipt = await contract.methods.safeTransferFrom(account.address, destAddress, selectedToken.tokenID).send({
          from: account.address,
          gasPrice: 100,
        })
      } else {
        receipt = await contract.methods.safeTransferFrom(account.address, destAddress, selectedToken.tokenID, selectedToken.amount).send({
          from: account.address,
          gasPrice: 100,
        })
      }
      return receipt
    } catch (ex) {
      message.error(`Error during rescue: ${ex.toString()}`)
    } finally {
      api.web3().eth.accounts.wallet.clear()
    }
  }

  useEffect(() => {
    if (!privateKey) {
      return
    }
    try {
      const key = privateKey.startsWith('0x') ? privateKey : '0x' + privateKey
      const keyAddress = web3.eth.accounts.privateKeyToAddress(key)
      const match = keyAddress.toLowerCase() === inputAddress.value.toLowerCase()
      setKeyMatch(match)
      console.log('keyAddress', keyAddress, 'keyMatch', match)
    } catch (ex) {
      message.error('Unable to parse private key')
      console.error(ex)
    }
  }, [privateKey, inputAddress.value])

  useEffect(() => {
    if (!inputAddress.value) {
      return
    }
    getErc721Assets(inputAddress.value).then(assets => {
      console.log(assets)
      setErc721s(assets)
    }).catch(ex => {
      console.error(ex)
    })
    getErc1155Balances(inputAddress.value).then(assets => {
      console.log(assets)
      setErc1155s(assets)
    }).catch(ex => {
      console.error(ex)
    })
  }, [inputAddress.value])

  return (
    <AnimatedSection wide>
      <Space direction='vertical' style={{ width: '100%' }}>
        {destAddress && <Text>Connected MetaMask: {destAddress}</Text>}
        {!destAddress && <Button onClick={connect}>Connect MetaMask</Button>}
        <Button onClick={() => sendFund()} disabled={!keyMatch || !destAddress}>Send 1 ONE from MetaMask + Try Rescuing Selected NFT</Button>
        {/* <Button onClick={() => tryRescue()} disabled={!keyMatch || !destAddress}>Try Rescue NFTs</Button> */}
        {selectedToken.tokenAddress && (
          <>
            <Text>Selected Token to Rescue:</Text>
            <Text>Contract: {selectedToken.tokenAddress}</Text>
            <Text>Token ID: {selectedToken.tokenID}</Text>
            <Text>Name: {selectedToken.meta?.name}</Text>
            <Text>Amount: {selectedToken.amount ?? 1}</Text>
          </>)}
        <Divider />
        <Hint>Compromised Wallet's Address</Hint>
        <AddressInput
          addressValue={inputAddress}
          setAddressCallback={setInputAddress}
        />
        <Hint style={{ fontSize: 12, color: '#aaa' }}>(equivalent to {util.safeNormalizedAddress(inputAddress.value)})</Hint>
        <Spacer />
        <Hint>Compromised Wallet's Private Key</Hint>
        <InputBox type='password' margin='auto' style={{ width: '100%' }} value={privateKey} onChange={({ target: { value } }) => setPrivateKey(value)} placeholder='Private key of the compromised wallet' />
        {keyMatch !== null && <Text style={{ color: keyMatch ? 'green' : 'red' }}>{keyMatch ? 'Key matches with address' : 'Key does not match provided address'}</Text>}
        <Spacer />
        <Hint>ERC721 owned</Hint>
        <Table
          dataSource={erc721s}
          columns={[
            {
              title: 'Contract',
              dataIndex: 'tokenAddress',
              key: 'tokenAddress',
              // eslint-disable-next-line react/display-name
              render: (text) => {
                return <WalletAddress shorten address={text} useHex alwaysShowOptions />
              }
            },
            {
              title: 'TokenID',
              dataIndex: 'tokenID',
              key: 'tokenID',
              // eslint-disable-next-line react/display-name
              render: (text) => {
                return <Text style={{ width: 64, wordBreak: 'break-all' }} ellipsis>{text}</Text>
              }
            },
            {
              title: 'Name',
              dataIndex: ['meta', 'name'],
              key: 'name',
              // eslint-disable-next-line react/display-name
              render: (text) => {
                return <Paragraph style={{ width: 80, wordBreak: 'break-word' }}>{text}</Paragraph>
              }
            },
            {
              title: 'Use',
              key: 'select',
              // eslint-disable-next-line react/display-name
              render: (text, record) => {
                const selected = selectedToken.tokenAddress === record.tokenAddress && selectedToken.tokenID === record.tokenID
                return (
                  <Button size='small' shape='round' onClick={() => setSelectedToken({ ...record, type: '721' })} disabled={selected}>
                    {selected ? <CheckOutlined /> : 'Use'}
                  </Button>
                )
              }
            }
          ]}
        />
        <Hint>ERC1155 owned</Hint>
        <Table
          dataSource={erc1155s}
          columns={[
            {
              title: 'Contract',
              dataIndex: 'tokenAddress',
              key: 'tokenAddress',
              // eslint-disable-next-line react/display-name
              render: (text) => {
                return <WalletAddress shorten address={text} useHex alwaysShowOptions />
              }
            },
            {
              title: 'TokenID',
              dataIndex: 'tokenID',
              key: 'tokenID',
              // eslint-disable-next-line react/display-name
              render: (text) => {
                return <Text style={{ width: 64, wordBreak: 'break-all' }} ellipsis>{text}</Text>
              }
            },
            {
              title: 'Amount',
              dataIndex: 'amount',
              key: 'amount',
            },
            {
              title: 'Name',
              dataIndex: ['meta', 'name'],
              key: 'name',
              // eslint-disable-next-line react/display-name
              render: (text) => {
                return <Paragraph style={{ width: 80, wordBreak: 'break-word' }}>{text}</Paragraph>
              }
            },
            {
              title: 'Use',
              key: 'select',
              // eslint-disable-next-line react/display-name
              render: (text, record) => {
                const selected = selectedToken.tokenAddress === record.tokenAddress && selectedToken.tokenID === record.tokenID
                return (
                  <Button size='small' shape='round' onClick={() => setSelectedToken({ ...record, type: 'erc1155' })} disabled={selected}>
                    {selected ? <CheckOutlined /> : 'Use'}
                  </Button>
                )
              }
            }
          ]}
        />
      </Space>
    </AnimatedSection>
  )
}

export default RescueNFT
