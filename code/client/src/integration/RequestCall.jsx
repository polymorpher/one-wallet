import { Button, Space, Typography, Divider } from 'antd'
import message from '../message'
import BN from 'bn.js'
import AnimatedSection from '../components/AnimatedSection'
import { AverageRow } from '../components/Grid'
import { Hint, Li, Ul, Warning } from '../components/Text'
import React, { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import util, { useWindowDimensions } from '../util'
import WalletAddress from '../components/WalletAddress'
import { handleAddressError } from '../handler'
import Call from '../pages/Show/Call'
import { decodeKnownCall } from './knownCalls'
import { WALLET_OUTDATED_DISABLED_TEXT, WalletSelector } from './Common'
const { Title, Paragraph } = Typography
const RequestCall = ({ caller, callback, dest, calldata: calldataB64Encoded, amount, from, verbose }) => {
  dest = util.safeNormalizedAddress(dest)
  const balances = useSelector(state => state.balance)
  const price = useSelector(state => state.global.price)
  const { isMobile } = useWindowDimensions()
  const [selectedAddress, setSelectedAddress] = useState({})
  const { formatted: amountFormatted, fiatFormatted: amountFiatFormatted } = util.computeBalance(amount || 0, price)
  const isNonZeroAmount = !(new BN(amount).isZero())
  // Format: {method, parameters, comment}
  // - method: the function's signature, for example, `commit(bytes32,bytes32,bytes32)` is the signature for `function commit(bytes32 hash, bytes32 paramsHash, bytes32 verificationHash) external`;
  // - parameters: an array of name-value pairs of length correspond to the function signature. Using above example, the parameters could be `[{"name":"hash", "value":"0x1234..."},{"name":"paramsHash", "value":"0xffff..."},{"name":"verificationHash", "value":"0xffff..."}]`
  // - comment: anything the app developer wants to add to explain to the user what the app is asking for.
  const [calldata, setCalldata] = useState({})
  const [showCall, setShowCall] = useState(false)
  const [callbackVerified, setCallbackVerified] = useState(false)
  const [showDetails, setShowDetails] = useState(verbose)

  useEffect(() => {
    if (selectedAddress.value && (calldata.hex || calldata.method)) {
      setShowCall(true)
    }
  }, [selectedAddress, calldata])

  useEffect(() => {
    const decodeHex = async (data) => {
      const { error, name, method, parameters, verifiedDomains } = await decodeKnownCall({ address: dest, bytes: data.hex })
      // console.log({ error, name, method, parameters })
      if (error) {
        message.error(error)
        return
      }
      if (method && parameters) {
        setCalldata({ ...data, name, method, parameters, decodedHex: true })
      } else {
        setCalldata(data)
      }
      if (verifiedDomains && callback) {
        for (const r of verifiedDomains) {
          if (callback.match(r)) {
            setCallbackVerified(true)
            break
          }
        }
      }
    }

    const calldataDecoded = Buffer.from(calldataB64Encoded || '', 'base64')
    try {
      const data = JSON.parse(calldataDecoded)
      if (data.hex) {
        decodeHex(data)
      } else {
        setCalldata(data)
      }
    } catch (ex) {
      message.error('Unable to parse call data from the app')
      console.error(ex)
    }
  }, [])

  const next = () => {
    if (!selectedAddress.value) {
      return message.error('No address is selected')
    }
    const normalizedAddress = util.safeExec(util.normalizedAddress, [selectedAddress.value], handleAddressError)
    if (!normalizedAddress) {
      return message.error(`normalizedAddress=${normalizedAddress}`)
    }
    const balance = balances[selectedAddress.value]
    if (!(new BN(amount).lte(new BN(balance)))) {
      const { formatted: balanceFormatted } = util.computeBalance(balance)
      return message.error(`Insufficient balance (${balanceFormatted} ONE) in the selected wallet`)
    }
    setShowCall(true)
  }
  const cancel = () => {
    window.location.href = callback + '?success=0'
  }
  const onCallClose = () => {
    setShowCall(false)
  }
  const onSuccess = (txId) => {
    window.location.href = callback + `?success=1&txId=${txId}`
  }

  return (
    <>
      <AnimatedSection
        show
        style={{ minHeight: 320, maxWidth: 720 }}
      >
        <AverageRow style={{ margin: 0 }}>
          <Space direction='vertical' style={{ maxWidth: '100%' }}>
            <Title level={3}>"{caller}" wants your 1wallet to do something </Title>
            {calldata.comment && <Paragraph>Reason: {calldata.comment} </Paragraph>}
            {isNonZeroAmount &&
              <AverageRow>
                <Space direction='vertical'>
                  <Title level={3}>...and pay</Title>
                  <Title level={3}>{amountFormatted} ONE <Hint>(≈ ${amountFiatFormatted} USD)</Hint></Title>
                  <Paragraph>To: <WalletAddress showLabel address={dest} /> </Paragraph>
                </Space>
              </AverageRow>}
            <Divider style={{ marginTop: isMobile ? 8 : 24, marginBottom: isMobile ? 8 : 24 }} />
            <Title level={3}>Technical details <Button type='link' style={{ marginLeft: 16 }} onClick={() => setShowDetails(!showDetails)}>{showDetails ? 'Hide' : 'Expand...'}</Button></Title>
            {!showDetails && calldata.hex && (calldata.decodedHex && callbackVerified ? <Paragraph>✅ Verified Call</Paragraph> : <Paragraph>❌ Cannot verify safety</Paragraph>)}
            {showDetails && <Paragraph>Call address: <WalletAddress showLabel address={dest} addressStyle={{ padding: 0 }} /></Paragraph>}
            {calldata.hex && !calldata.decodedHex && showDetails &&
              <>
                <Warning>The app is making an unrecognizable call using binary data, without disclosing method name or parameter values. Malicious apps may steal your NFTs or tokens using specific binary data. Please be cautious and double check the data and the safety of the app. If your tokens are stolen this way, 1wallet cannot help you recover your asset. Use it at your own risk. Please ask the app developer to provide call method name and parameter values. </Warning>
                <Paragraph>Hex Data: {calldata.hex}</Paragraph>
              </>}
            {!(calldata.hex && !calldata.decodedHex) && showDetails &&
              <>
                {calldata.decodedHex && <Paragraph>✅ Decoded and verified from binary call data</Paragraph>}
                {calldata.decodedHex && <Paragraph>✅ Contract: {calldata.name}</Paragraph>}
                {calldata.decodedHex && (callbackVerified ? <Paragraph>✅ Callback domain verified: {callback}</Paragraph> : <Paragraph>❌ Unrecognized callback domain: {callback}</Paragraph>)}
                <Paragraph>Function: {calldata.method}</Paragraph>
                <Paragraph>Parameters:</Paragraph>
                <Ul>
                  {calldata?.parameters?.map((kv, i) => {
                    return <Li ellipsis={{ expandable: true }} key={`${i}-${kv.name}`}>[{i}] {kv.name}: {kv.value}</Li>
                  })}
                </Ul>
              </>}
          </Space>
        </AverageRow>
        <Divider style={{ marginTop: isMobile ? 8 : 24, marginBottom: isMobile ? 8 : 24 }} />
        <WalletSelector from={from} onAddressSelected={setSelectedAddress} filter={e => e.majorVersion >= 10} disabledText={WALLET_OUTDATED_DISABLED_TEXT} />
        {!showCall &&
          <AverageRow justify='space-between'>
            <Button size='large' type='text' onClick={cancel} danger>Cancel</Button>
            <Button
              type='primary' size='large' shape='round' onClick={next}
              disabled={!(selectedAddress?.value)}
            >Next
            </Button>
          </AverageRow>}

      </AnimatedSection>
      {showCall &&
        <Call
          shouldAutoFocus
          minimal={!showDetails}
          address={selectedAddress.value} show={showCall} onClose={onCallClose} onSuccess={onSuccess}
          prefillHex={calldata.hex}
          prefillAmount={amountFormatted} prefillDest={dest} prefillData={(calldata.parameters || []).map(e => e.value)} prefillMethod={calldata.method}
        />}
    </>
  )
}

export default RequestCall
