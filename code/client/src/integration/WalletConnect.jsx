import React, { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import WalletConnectClient from '@walletconnect/client'
import { InputBox, Text } from '../components/Text'
import Image from 'antd/es/image'
import { Row } from 'antd/es/grid'
import Button from 'antd/es/button'
import cacheActions from '../state/modules/cache/actions'
import AnimatedSection from '../components/AnimatedSection'
import message from '../message'
import Spin from 'antd/es/spin'
import util, { checkCamera } from '../util'
import QrCodeScanner from '../components/QrCodeScanner'
import { WalletSelector } from './Common'

const WalletConnect = ({ wc }) => {
  const dispatch = useDispatch()
  const wallets = useSelector(state => state.wallet)
  const walletConnectSession = useSelector(state => state.cache.walletConnectSession)
  const walletList = Object.keys(wallets).filter(addr => util.safeNormalizedAddress(addr))
  const [selectedAddress, setSelectedAddress] = useState({ value: walletList[0] })
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(false)
  // Default to QR unless wc provided.
  const [isScanMode, setScanMode] = useState(!wc)
  const [hasCamera, setHasCamera] = useState(false)
  const [uri, setUri] = useState('')
  const [connector, setConnector] = useState(null)
  const [peerMeta, setPeerMeta] = useState(null)

  useEffect(() => {
    const f = async () => {
      const [hasCamera] = await checkCamera()
      setHasCamera(hasCamera)
    }

    f()
  }, [])

  useEffect(() => {
    if (wc) {
      initWalletConnect(wc)
    }
  }, [wc])

  const subscribeToEvents = (connector) => {
    console.log('ACTION', 'subscribeToEvents')

    if (connector) {
      connector.on('session_request', (error, payload) => {
        console.log('EVENT', 'session_request')

        if (error) {
          throw error
        }
        console.log('SESSION_REQUEST', payload.params)
        //  dispatch(cacheActions.fetchVersion({ network }))
        const { peerMeta } = payload.params[0]
        setPeerMeta(peerMeta)
      })

      connector.on('session_update', error => {
        console.log('EVENT', 'session_update')

        if (error) {
          throw error
        }

        dispatch(cacheActions.updateWalletConnectSession(connector.session))
      })

      connector.on('call_request', async (error, payload) => {
        console.log('EVENT', 'call_request', 'method', payload.method)
        console.log('EVENT', 'call_request', 'params', payload.params)

        if (error) {
          throw error
        }

        // call request
      })

      connector.on('connect', (error, payload) => {
        console.log('EVENT', 'connect')

        if (error) {
          throw error
        }

        setConnected(true)
        dispatch(cacheActions.updateWalletConnectSession(connector.session))
      })

      connector.on('disconnect', (error, payload) => {
        console.log('EVENT', 'disconnect')

        if (error) {
          throw error
        }

        setConnected(false)
        setLoading(false)
        setConnector(null)
        setPeerMeta(null)
        dispatch(cacheActions.updateWalletConnectSession(null))
      })

      if (connector.connected) {
        setConnected(true)
      }

      setConnector(connector)
    }
  }

  useEffect(() => {
    if (walletConnectSession) {
      const connector = new WalletConnectClient({ session: walletConnectSession })
      subscribeToEvents(connector)
    }
  }, [])

  const initWalletConnect = async (uri, reportOnError = true) => {
    setLoading(true)

    try {
      const connector = new WalletConnectClient({
        uri,
        clientMeta: {
          description: '1Wallet',
          url: 'https://1wallet.crazy.one',
          icons: ['https://1wallet.crazy.one/1wallet.png'],
          name: '1Wallet',
        }
      })

      if (!connector.connected) {
        await connector.createSession()
      }

      setLoading(false)

      subscribeToEvents(connector)
    } catch (error) {
      if (reportOnError) {
        message.error('Failed to connect.', 15)
      }
      setLoading(false)
    }
  }

  const approveSession = () => {
    console.log('ACTION', 'approveSession')
    if (connector) {
      connector.approveSession({ chainId: connector.chainId, accounts: [selectedAddress.value] })
    }
  }

  const rejectSession = () => {
    console.log('ACTION', 'rejectSession')
    if (connector) {
      connector.rejectSession()
    }
  }

  const disconnect = () => {
    console.log('ACTION', 'killSession')
    if (connector) {
      connector.killSession()
    }
  }

  const onScan = (uri) => {
    initWalletConnect(uri, /* reportOnError= */ false)
  }

  useEffect(() => {
    if (!uri) {
      return
    }
    initWalletConnect(uri)
  }, [uri])

  return (
    <AnimatedSection>
      {loading && (
        <Row type='flex' justify='center' align='middle' style={{ minHeight: '100vh' }}>
          <Spin size='large' />
        </Row>)}
      {!connected
        ? (peerMeta && peerMeta.name
            ? (
              <>
                <Row type='flex' justify='center' align='middle'>
                  <Image src={peerMeta.icons[0]} alt={peerMeta.name} />
                </Row>
                <Row type='flex' justify='center' align='middle'>
                  <Text>{peerMeta.name}</Text>
                </Row>
                <Row type='flex' justify='center' align='middle'>
                  <Text>{peerMeta.description}</Text>
                </Row>
                <Row type='flex' justify='center' align='middle'>
                  <Text>{peerMeta.url}</Text>
                </Row>
                <Row type='flex' justify='center' align='middle'>
                  <Button onClick={approveSession}>Approve</Button>
                  <Button onClick={rejectSession}>Reject</Button>
                </Row>
              </>)
            : (
              <>
                <WalletSelector onAddressSelected={setSelectedAddress} filter={e => e.majorVersion >= 10} showOlderVersions={false} useHex={false} />
                {!isScanMode && (
                  <>
                    <InputBox margin='auto' width={440} value={uri} onChange={({ target: { value } }) => setUri(value)} placeholder='Paste wc: uri...' />
                    {hasCamera && <Button onClick={() => setScanMode(true)}>Scan</Button>}
                  </>)}
                {/* TODO: disable text upload mode, it's used for dev debugging only. */}
                {isScanMode && hasCamera && <QrCodeScanner shouldInit supportedNonImgFiles={['text/plain']} btnText='Use Image or Text Instead' onScan={onScan} />}
              </>))
        : (
          <>
            <Row type='flex' justify='center' align='middle'>
              <Text>Connected!</Text>
            </Row>
            <Row type='flex' justify='center' align='middle'>
              <Button onClick={disconnect}>Disconnect</Button>
            </Row>
          </>)}
    </AnimatedSection>
  )
}

export default WalletConnect
