import React, { useState, useEffect, useCallback } from 'react'
import { useSelector } from 'react-redux'
import { InputBox, Label, Link, SiderLink, Text } from '../components/Text'
import Image from 'antd/es/image'
import { Row } from 'antd/es/grid'
import ConfigProvider from 'antd/es/config-provider'
import Button from 'antd/es/button'
import AnimatedSection from '../components/AnimatedSection'
import message from '../message'
import Spin from 'antd/es/spin'
import util, { checkCamera } from '../util'
import QrCodeScanner from '../components/QrCodeScanner'
import { WalletSelector } from './Common'
import Send from '../pages/Show/Send'
import List from 'antd/es/list'
import { Core } from '@walletconnect/core'
import { Web3Wallet } from '@walletconnect/web3wallet'
import { WalletConnectId } from '../config'
import api from '../api'
import { web3Provider } from './Web3Provider'
import Col from 'antd/es/col'
import WCLogo from '../../assets/wc.png'
import QrcodeOutlined from '@ant-design/icons/QrcodeOutlined'
// see https://docs.walletconnect.com/2.0/specs/sign/error-codes
const UNSUPPORTED_CHAIN_ERROR_CODE = 5100
const INVALID_METHOD_ERROR_CODE = 1001
const USER_REJECTED_REQUEST_CODE = 4001
const USER_DISCONNECTED_CODE = 6000

const PromptView = ({ peerMeta, approveSession, rejectSession }) => {
  return (
    <>
      <Row type='flex' justify='center' align='middle'>
        <Image style={{ maxWidth: '100px' }} src={peerMeta.icons[0]} alt={peerMeta.name} />
      </Row>
      <Row type='flex' justify='center' align='middle'>
        <Text>{peerMeta.name}</Text>
      </Row>
      <Row type='flex' justify='center' align='middle'>
        <Text>{peerMeta.description}</Text>
      </Row>
      <Row type='flex' justify='center' align='middle'>
        <Link target='_blank' href={peerMeta.url} rel='noreferrer'>{peerMeta.url}</Link>
      </Row>
      <Row type='flex' justify='center' align='middle' style={{ marginTop: '24px' }}>
        <Button style={{ marginRight: '24px' }} onClick={approveSession}>Approve</Button>
        <Button onClick={rejectSession}>Reject</Button>
      </Row>
    </>
  )
}

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
  'safe_setSettings',
]

const WalletConnect = ({ wcSesssionUri }) => {
  // const dispatch = useDispatch()
  const wallets = useSelector(state => state.wallet)
  // const walletConnectSession = useSelector(state => state.cache.walletConnectSession)
  const walletList = Object.keys(wallets).filter(addr => util.safeNormalizedAddress(addr))
  const [selectedAddress, setSelectedAddress] = useState({ value: walletList[0]?.address, label: walletList[0]?.name })
  const [loading, setLoading] = useState(false)
  // Default to QR unless a session uri is provided.
  const [isScanMode, setScanMode] = useState(false)
  const [hasCamera, setHasCamera] = useState(false)
  const [uri, setUri] = useState(wcSesssionUri || '')
  const [peerMeta, setPeerMeta] = useState(null)
  // eslint-disable-next-line no-unused-vars
  const [requests, setRequests] = useState([])
  const [web3Wallet, setWeb3Wallet] = useState(undefined)
  const [isWcInitialized, setIsWcInitialized] = useState()
  const [wcSession, setWcSession] = useState()
  const [error, setError] = useState('')

  useEffect(() => {
    const f = async () => {
      const [hasCamera] = await checkCamera()
      setHasCamera(hasCamera)
    }

    f()
  }, [])

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
        const { id, params } = proposal
        const { requiredNamespaces } = params

        message.debug(`Session proposal: ${JSON.stringify(proposal)}`)

        const account = `${EVMBasedNamespaces}:${chainId}:${selectedAddress.value}`
        console.log('selectedAddress', selectedAddress)
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
          console.log('wcSession', wcSession)
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
        }
      })

      web3Wallet.on('session_delete', async () => {
        setWcSession(undefined)
        setError(undefined)
      })

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
        setIsWcInitialized(true)
      } finally {
        setLoading(false)
      }
    }
    initWalletConnect()
  }, [])

  // session_request needs to be a separate Effect because a valid wcSession should be present
  useEffect(() => {
    if (isWcInitialized && web3Wallet && wcSession) {
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
          const result = await web3Provider.send(method, params)
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
    web3Provider,
  ])

  useEffect(() => {
    setPeerMeta(wcSession?.peer.metadata)
  }, [wcSession])

  const wcConnect = useCallback(
    async (uri) => {
      const isValidWalletConnectUri = uri && uri.startsWith('wc')

      if (isValidWalletConnectUri && web3Wallet) {
        await web3Wallet.core.pairing.pair({ uri })
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
  }, [web3Wallet, wcSession])

  const onScan = (uri) => {
    if (!uri) {
      return
    }
    wcConnect(uri)
  }

  useEffect(() => {
    if (!uri) {
      return
    }
    wcConnect(uri)
  }, [uri])

  return (
    <AnimatedSection>
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
          <Row align='baseline' style={{ marginTop: 16, marginBottom: 16 }}>
            <Col xs={4}>
              <Button size='large' onClick={() => setScanMode(e => !e)}>
                <QrcodeOutlined style={{ fontSize: 24 }} />
              </Button>
            </Col>
            <Col xs={20}>
              <InputBox margin='auto' width={440} value={uri} onChange={({ target: { value } }) => setUri(value)} placeholder='Scan QR Code or paste connection link here (wc:...)' />
            </Col>
          </Row>
          {selectedAddress.value && isScanMode && <QrCodeScanner shouldInit uploadBtnText='Upload QR Code Instead' onScan={onScan} />}
        </>}
      {wcSession && (
        <>
          <Row type='flex' justify='center' align='middle'>
            <Text>{selectedAddress.value}</Text>
            <Button type='link' onClick={wcDisconnect}>Disconnect</Button>
          </Row>
          <ConfigProvider renderEmpty={() => (
            <Text>No pending requests for this wallet.</Text>
          )}
          >
            <List
              style={{ marginTop: '24px' }}
              size='large'
              bordered
              dataSource={requests}
                // TODO: customize item render based on request method type.
              renderItem={item => (
                <List.Item
                  actions={[<Button key='request-list-action-approve' onClick={() => {}/* approveRequest(item) */}>Approve</Button>, <Button key='request-list-action-reject' onClick={() => {}/* rejectRequest(item) */}>Reject</Button>]}
                >
                  {item.method}
                  {item.method === 'eth_sendTransaction' &&
                    <Send
                      address={selectedAddress.value} onSuccess={() => alert('a')}
                      prefillAmount={10}
                    />}
                </List.Item>)}
            />
          </ConfigProvider>
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
