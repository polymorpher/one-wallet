import React, { useState, useEffect, useCallback } from 'react'
import { useSelector } from 'react-redux'
import { InputBox, Link, Text } from '../components/Text'
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
  const [selectedAddress, setSelectedAddress] = useState({ value: walletList[0] })
  const [loading, setLoading] = useState(false)
  // Default to QR unless a session uri is provided.
  const [isScanMode, setScanMode] = useState(!wcSesssionUri)
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
        .find(session => session.namespaces[EVMBasedNamespaces].accounts[0] === `${EVMBasedNamespaces}:${chainId}:${selectedAddress}`)

      if (compatibleSession) {
        setWcSession(compatibleSession)
      }

      // events
      web3Wallet.on('session_proposal', async proposal => {
        const { id, params } = proposal
        const { requiredNamespaces } = params

        message.debug(`Session proposal: ${JSON.stringify(proposal)}`)

        const account = `${EVMBasedNamespaces}:${chainId}:${selectedAddress}`
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
        <Text type='danger'>Error: ${error}</Text>
      )}
      {!wcSession
        ? (peerMeta && peerMeta.name
            ? <PromptView peerMeta={peerMeta} /* approveSession={approveSession} rejectSession={rejectSession} */ />
            : (
              <>
                <WalletSelector onAddressSelected={setSelectedAddress} filter={e => e.majorVersion >= 10} showOlderVersions={false} useHex={false} />
                {/* If no camera or `uri` provided, do not show the qr scanner initially. */}
                {(!isScanMode || !hasCamera) && (
                  <>
                    <InputBox margin='auto' width={440} value={uri} onChange={({ target: { value } }) => setUri(value)} placeholder='Paste wc: uri...' />
                    {hasCamera && <Button onClick={() => setScanMode(true)}>Scan</Button>}
                  </>)}
                {selectedAddress.value && isScanMode && hasCamera && <QrCodeScanner shouldInit uploadBtnText='Upload QR Code Instead' onScan={onScan} />}
              </>))
        : (
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
