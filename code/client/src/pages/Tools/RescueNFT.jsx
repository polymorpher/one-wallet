import React, { useEffect, useState } from 'react'
import AnimatedSection from '../../components/AnimatedSection'
import { Hint, HintSmall, InputBox, Link, Paragraph, Text } from '../../components/Text'
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
import config from '../../config'
import { useSelector } from 'react-redux'
import Steps from 'antd/es/steps'
import Spin from 'antd/es/spin'

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
  const [gasPrice, setGasPrice] = useState(100e+9)
  const [gasMultiplier, setGasMultiplier] = useState(15)
  const network = useSelector(state => state.global.network)

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
    // await tryRescue()
    // return
    const tx = {
      from: destAddress,
      to: inputAddress.value,
      value: util.toBalance(1.0).balance.toString(),
      gasPrice
    }
    console.log(tx)
    try {
      const rx1 = await web3.eth.sendTransaction(tx)
      console.log('Fund sent, receipt:', rx1)
      // const receipt = await tryRescue()
      // console.log('Rescue success, receipt', receipt)
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
    const account = w3.eth.accounts.privateKeyToAccount(key)

    try {
      w3.eth.accounts.wallet.add(account)
      const contract = await api.tokens.getTokenContract[selectedToken.type.toLowerCase()](selectedToken.tokenAddress)
      let receipt
      if (selectedToken.type.toLowerCase() === 'erc721') {
        receipt = await contract.methods.safeTransferFrom(account.address, destAddress, selectedToken.tokenID).send({
          from: account.address,
          gasPrice: gasPrice * gasMultiplier,
        })
      } else {
        receipt = await contract.methods.safeTransferFrom(account.address, destAddress, selectedToken.tokenID, selectedToken.amount).send({
          from: account.address,
          gasPrice: gasPrice * gasMultiplier,
        })
      }
      return receipt
    } catch (ex) {
      message.error(`Error during rescue: ${ex.toString()}`)
      console.error(ex)
    } finally {
      api.web3().eth.accounts.wallet.clear()
    }
  }

  const tryRescueWrapper = async () => {
    const receipt = await tryRescue()
    if (receipt) {
      console.log('Rescue success, receipt', receipt)
      const link = config.networks[network].explorer.replace(/{{txId}}/, receipt.transactionHash)
      message.success(
        <Text>
          Done! View transaction
          <Link
            href={link} target='_blank'
            rel='noreferrer'
          > {util.ellipsisAddress(receipt.transactionHash)}
          </Link>
        </Text>, 10)
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
      setErc721s(assets.map(a => ({ ...a, type: 'erc721', key: `${a.tokenAddress}|${a.tokenID}` })))
    }).catch(ex => {
      console.error(ex)
    })
    getErc1155Balances(inputAddress.value).then(assets => {
      console.log(assets)
      setErc1155s(assets.map(a => ({ ...a, type: 'erc1155', key: `${a.tokenAddress}|${a.tokenID}` })))
    }).catch(ex => {
      console.error(ex)
    })
  }, [inputAddress.value])

  useEffect(() => {
    api.rpc.gasPrice().then(g => setGasPrice(g))
  }, [])

  return (
    <AnimatedSection wide>
      <Space direction='vertical' style={{ width: '100%' }}>
        <Text>This tool is designed for victims whose wallet got drained by hackers and have a drain-bot attached to the wallet. The victim still has NFTs left in their wallet, which they want to move to other wallets. Victims are unable to do anything by themselves because when a drain bot is attached to the victim's wallet, any fund sent to that wallet will be quickly transferred to a hacker's wallet, causing victim's transactions to fail for unable to pay gas. </Text>
        <Spacer />
        <Steps direction='vertical'>
          <Steps.Step
            title='Connect' description={(
              <Space direction='vertical'>
                {destAddress ? <Text>Connected MetaMask: {destAddress}</Text> : <Button shape='round' onClick={connect}> Connect MetaMask</Button>}
                <Text>This wallet will receive the rescued NFTs</Text>
              </Space>
          )}
          />
          <Steps.Step title='Recharge' description={<Button shape='round' onClick={() => sendFund()} disabled={!keyMatch || !destAddress}>Send 1 ONE from MetaMask</Button>} />
          <Steps.Step
            title='Rescue' description={
              <Space direction='vertical'>
                <Button shape='round' type='primary' onClick={() => tryRescueWrapper()} disabled={!keyMatch || !destAddress}>Rescue Selected NFT</Button>
                <Text>Spam this button immediately after recharging, until you see green success prompt</Text>
              </Space>
          }
          />
        </Steps>

        {selectedToken.tokenAddress && (
          <>
            <Text>Selected Token to Rescue:</Text>
            <Text><b>Contract</b> {selectedToken.tokenAddress}</Text>
            <Text><b>Token ID</b> {selectedToken.tokenID}</Text>
            <Text><b>Name</b> {selectedToken.meta?.name}</Text>
            <Text><b>Amount</b> {selectedToken.amount ?? 1}</Text>
          </>)}
        <Divider />
        <Hint>Compromised Wallet's Address</Hint>
        <AddressInput
          addressValue={inputAddress}
          setAddressCallback={setInputAddress}
          showHexHint
        />
        <Spacer />
        <Hint>Compromised Wallet's Private Key</Hint>
        <InputBox type='password' margin='auto' style={{ width: '100%' }} value={privateKey} onChange={({ target: { value } }) => setPrivateKey(value)} placeholder='Private key of the compromised wallet' />
        {keyMatch !== null && <Text style={{ color: keyMatch ? 'green' : 'red' }}>{keyMatch ? 'Key matches with address' : 'Key does not match provided address'}</Text>}
        <Spacer />
        <Hint>Gas Price Multiplier</Hint>
        <InputBox margin='auto' value={gasMultiplier} onChange={({ target: { value } }) => setGasMultiplier(Number(value) || 0)} />
        <Hint style={{ fontSize: 12, color: '#aaa' }}>Actual gas price for transaction will be network minimum gas price (normally 100 gwei) multiplied by the multiplier. Rescue transaction's gas price must be above what is used by the hacker's drain bot to be effective. Check explorer to find out what the hacker has used. </Hint>
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
                  <Button size='small' shape='round' onClick={() => setSelectedToken(record)} disabled={selected}>
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
                  <Button size='small' shape='round' onClick={() => setSelectedToken(record)} disabled={selected}>
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
