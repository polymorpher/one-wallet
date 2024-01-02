import React, { useState, useEffect, useCallback } from 'react'
import { useSelector } from 'react-redux'
import { Hint, InputBox, SiderLink, Text } from '../components/Text'
import Image from 'antd/es/image'
import { Row } from 'antd/es/grid'
import Button from 'antd/es/button'
import AnimatedSection from '../components/AnimatedSection'
import message from '../message'
import Spin from 'antd/es/spin'
import util from '../util'
import QrCodeScanner from '../components/QrCodeScanner'
import { WalletSelector } from './Common'
import { Core } from '@walletconnect/core'
import { Web3Wallet } from '@walletconnect/web3wallet'
import { WalletConnectId } from '../config'
import api from '../api'
import { SimpleWeb3Provider } from './Web3Provider'
import WCLogo from '../../assets/wc.png'
import QrcodeOutlined from '@ant-design/icons/QrcodeOutlined'
import Space from 'antd/es/space'
import WalletAddress from '../components/WalletAddress'
import Paths from '../constants/paths'
import WalletConnectActionModal from './WalletConnectActionModal'
// see https://docs.walletconnect.com/2.0/specs/sign/error-codes
const UNSUPPORTED_CHAIN_ERROR_CODE = 5100
const INVALID_METHOD_ERROR_CODE = 1001
const USER_REJECTED_REQUEST_CODE = 4001
const USER_DISCONNECTED_CODE = 6000

const EVMBasedNamespaces = 'eip155'

const SupportedMethods = [
  'eth_accounts',
  'net_version',
  'eth_chainId',
  'personal_sign',
  'eth_sign',
  'eth_signTypedData',
  'eth_signTypedData_v4',
  'eth_sendTransaction',
  'eth_blockNumber',
  'eth_getBalance',
  'eth_getCode',
  'eth_getTransactionCount',
  'eth_getStorageAt',
  'eth_getBlockByNumber',
  'eth_getBlockByHash',
  'eth_getTransactionByHash',
  'eth_getTransactionReceipt',
  'eth_estimateGas',
  'eth_call',
  'eth_getLogs',
  'eth_gasPrice',
  'wallet_getPermissions',
  'wallet_requestPermissions',
]

const devOnlyMethods = ['eth_sign']

const WalletConnect = ({ wcSesssionUri }) => {
  // const dispatch = useDispatch()
  const wallets = useSelector(state => state.wallet)
  const walletList = Object.keys(wallets).filter(addr => util.safeNormalizedAddress(addr))
  const [selectedAddress, setSelectedAddress] = useState({ value: walletList[0]?.address, label: walletList[0]?.name })
  const [loading, setLoading] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [isScanMode, setScanMode] = useState(false)
  const [uri, setUri] = useState(wcSesssionUri || '')
  const [peerMeta, setPeerMeta] = useState(null)
  const [web3Wallet, setWeb3Wallet] = useState(undefined)
  const [isWcInitialized, setIsWcInitialized] = useState()
  const [wcSession, setWcSession] = useState()
  const [error, setError] = useState('')
  const [hint, setHint] = useState('')
  const [web3Provider] = useState(SimpleWeb3Provider({ defaultAddress: selectedAddress.value }))
  const dev = useSelector(state => state.global.dev)

  useEffect(() => {
    if (!isWcInitialized && web3Wallet) {
      const { chainId, activeNetwork } = api.blockchain.getChainInfo()
      // we try to find a compatible active session
      const activeSessions = web3Wallet.getActiveSessions()
      const compatibleSession = Object.keys(activeSessions)
        .map(topic => activeSessions[topic])
        .find(session => session.namespaces[EVMBasedNamespaces].accounts[0] === `${EVMBasedNamespaces}:${chainId}:${selectedAddress.value}`)

      if (compatibleSession) {
        setWcSession(compatibleSession)
      }

      // events
      web3Wallet.on('session_proposal', async proposal => {
        setConnecting(true)
        const { id, params } = proposal
        const { requiredNamespaces } = params

        message.debug(`Session proposal: ${JSON.stringify(proposal)}`)

        const account = `${EVMBasedNamespaces}:${chainId}:${selectedAddress.value}`
        // console.log('selectedAddress', selectedAddress)
        const chain = `${EVMBasedNamespaces}:${chainId}`
        const events = requiredNamespaces[EVMBasedNamespaces]?.events || [] // accept all events, similar to Gnosis Safe

        try {
          const wcSession = await web3Wallet.approveSession({
            id,
            namespaces: {
              eip155: {
                accounts: [account], // only the Safe account
                chains: [chain], // only the Safe chain
                methods: SupportedMethods, // only the Safe methods
                events,
              },
            },
          })
          // console.log('wcSession', wcSession)
          setWcSession(wcSession)
          setError(undefined)
        } catch (error) {
          message.error(`WC session proposal error: ${error}`)
          setError('Failed to establish WalletConnect V2 connection. Please check the console for error and contact support.')

          const errorMessage = `Connection refused: This Account is in ${activeNetwork} (chainId: ${chainId}) but the Wallet Connect session proposal is not valid because it contains: 1) A required chain different than ${activeNetwork} 2) Does not include ${activeNetwork} between the optional chains 3) No EVM compatible chain is included`
          console.log(errorMessage)
          await web3Wallet.rejectSession({
            id: proposal.id,
            reason: {
              code: UNSUPPORTED_CHAIN_ERROR_CODE,
              message: errorMessage,
            },
          })
        } finally {
          setConnecting(false)
        }
      })

      web3Wallet.on('session_delete', async () => {
        setWcSession(undefined)
        setError(undefined)
      })

      message.debug('WC Initialized')

      setIsWcInitialized(true)
    }
  }, [selectedAddress, web3Wallet, isWcInitialized])

  useEffect(() => {
    const initWalletConnect = async () => {
      setLoading(true)
      try {
        const core = new Core({
          projectId: WalletConnectId,
        })

        const w3w = await Web3Wallet.init({
          core,
          metadata: {
            description: 'OTP Wallet',
            url: 'https://otpwallet.xyz',
            icons: ['https://1wallet.crazy.one/1wallet.png'],
            name: 'OTPWallet',
          }
        })
        setWeb3Wallet(w3w)
      } catch (error) {
        message.error(`Error initializing WalletConnect: ${error}`)
        setIsWcInitialized(true)
      } finally {
        setLoading(false)
      }
    }
    initWalletConnect()
  }, [])

  // session_request needs to be a separate Effect because a valid wcSession should be present
  useEffect(() => {
    if (isWcInitialized && web3Wallet && wcSession && web3Provider) {
      const { chainId, activeNetwork } = api.blockchain.getChainInfo()

      web3Wallet.on('session_request', async event => {
        const { topic, id } = event
        const { request, chainId: transactionChainId } = event.params
        const { method, params } = request

        const isWalletChainId = transactionChainId === `${EVMBasedNamespaces}:${chainId}`

        // we only accept transactions from the Safe chain
        if (!isWalletChainId) {
          const errorMessage = `Transaction rejected: the connected dApp is not set to the correct chain. Make sure the dApp only uses ${activeNetwork} to interact with this wallet.`
          setError(errorMessage)
          await web3Wallet.respondSessionRequest({
            topic,
            response: rejectResponse(id, UNSUPPORTED_CHAIN_ERROR_CODE, errorMessage),
          })
          return
        }

        try {
          setError('')
          if (!dev && devOnlyMethods.includes(method)) {
            throw new Error(`${method} is only available when dev mode is enabled`)
          }
          const result = await web3Provider.send(method, params, id, selectedAddress.value)
          await web3Wallet.respondSessionRequest({
            topic,
            response: {
              id,
              jsonrpc: '2.0',
              result,
            },
          })
        } catch (error) {
          setError(error?.message)
          const isUserRejection = error?.message?.includes?.('Transaction was rejected')
          const code = isUserRejection ? USER_REJECTED_REQUEST_CODE : INVALID_METHOD_ERROR_CODE
          await web3Wallet.respondSessionRequest({
            topic,
            response: rejectResponse(id, code, error.message),
          })
        }
      })
    }
  }, [
    wcSession,
    isWcInitialized,
    web3Wallet,
    web3Provider
  ])

  useEffect(() => {
    setPeerMeta(wcSession?.peer.metadata)
  }, [wcSession])

  const wcConnect = useCallback(
    async (uri) => {
      const isValidWalletConnectUri = uri && uri.startsWith('wc')

      try {
        if (isValidWalletConnectUri && web3Wallet) {
          await web3Wallet.core.pairing.pair({ uri })
        }
      } catch (ex) {
        message.error(`Error connecting with WalletConnect: ${ex.toString()}`)
      }
    },
    [web3Wallet],
  )

  const wcDisconnect = useCallback(async () => {
    if (wcSession && web3Wallet) {
      await web3Wallet.disconnectSession({
        topic: wcSession.topic,
        reason: {
          code: USER_DISCONNECTED_CODE,
          message: 'User disconnected. Safe Wallet Session ended by the user',
        },
      })
      setWcSession(undefined)
      setError(undefined)
    }
    setUri('')
  }, [web3Wallet, wcSession])

  useEffect(() => {
    if (!uri) {
      return
    }
    setConnecting(true)
    setTimeout(() => setHint('Tips: If the wallet is not connecting automatically, check your connecting string and try again. Refresh if necessary'), 500)
    wcConnect(uri).finally(() => {
      setTimeout(() => setConnecting(false), 500)
    })
  }, [uri])

  return (
    <AnimatedSection>
      <WalletConnectActionModal />
      {loading && (
        <Row type='flex' justify='center' align='middle' style={{ minHeight: '100vh' }}>
          <Spin size='large' />
        </Row>)}
      {error && (
        <Text type='danger'>Error: {error}</Text>
      )}
      {/* <PromptView peerMeta={peerMeta} /* approveSession={approveSession} rejectSession={rejectSession} /> */}

      {!wcSession &&
        <>
          <Row type='flex' justify='center' style={{ margin: '16px' }}>
            <Image preview={false} src={WCLogo} style={{ height: 64 }} />
          </Row>
          <WalletSelector onAddressSelected={setSelectedAddress} filter={e => e.majorVersion >= 10} showOlderVersions={false} useHex={false} />
          <Text style={{ marginTop: 16, marginBottom: 16 }}>
            Connect your wallet to any dApp (e.g. <SiderLink href='https://multisig.harmony.one/'>Safe</SiderLink>, <SiderLink href='https://swap.harmony.one/'>Swap</SiderLink>, <SiderLink href='https://1.country/'>.country</SiderLink>)<br /><br />
            1. Select the wallet you want to connect to <br />
            2. Copy the connection link from the dApp's WalletConnect prompt, or scan the QR Code from that prompt <br />
            3. That's it! You can now use the wallet just like MetaMask or other mobile wallets
          </Text>
          {!connecting &&
            <Space direction='vertical' style={{ width: '100%' }}>
              <Row align='baseline' type='flex' style={{ marginTop: 32, marginBottom: 32, columnGap: 16 }}>
                <Button size='large' onClick={() => setScanMode(e => !e)}>
                  <QrcodeOutlined style={{ fontSize: 24 }} />
                </Button>
                <InputBox margin='auto' style={{ flex: 1 }} value={uri} onChange={({ target: { value } }) => setUri(value)} placeholder='Scan QR Code or paste connection link here (wc:...)' />
              </Row>
              <Hint>{hint}</Hint>
            </Space>}
          {connecting && <Row type='flex' justify='center' style={{ margin: '32px' }}><Spin size='large' /></Row>}
          {selectedAddress.value && isScanMode && <QrCodeScanner shouldInit uploadBtnText='Upload QR Code Instead' onScan={wcConnect} />}
        </>}
      {wcSession && (
        <>
          <Row type='flex' justify='flex-start' align='top' style={{ marginTop: '16px', marginBottom: 16, columnGap: 16, flexWrap: 'nowrap' }}>
            <Image preview={false} src={WCLogo} style={{ width: 96 }} />
            <Space direction='vertical'>
              <Text style={{ fontSize: 18 }}>Connected</Text>
              {peerMeta && <Text style={{ fontSize: 14 }}>{peerMeta.name} ({peerMeta.url})</Text>}
            </Space>
          </Row>
          <Space direction='vertical' style={{ marginTop: 16, marginBottom: 16, width: '100%', marginLeft: 16 }}>
            <Hint style={{ whiteSpace: 'nowrap' }}>Your wallet</Hint>
            <WalletAddress address={selectedAddress.value} alwaysShowOptions onClick={() => window.open(Paths.showAddress(selectedAddress.value), '_blank')} />
          </Space>
          <Row justify='center' style={{ marginTop: 32, marginBottom: 64 }}>
            <Button type='primary' size='large' shape='round' onClick={wcDisconnect}>Disconnect</Button>
          </Row>
          <Space direction='vertical'>
            <Text>Please leave this window open, otherwise transactions will not pop up.</Text>
          </Space>
        </>)}
    </AnimatedSection>
  )
}

export default WalletConnect

const rejectResponse = (id, code, message) => {
  return {
    id,
    jsonrpc: '2.0',
    error: {
      code,
      message,
    },
  }
}
