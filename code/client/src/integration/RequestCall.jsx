import { Button, message, Row, Space, Typography, Select, Col, Tooltip, Divider } from 'antd'
import BN from 'bn.js'
import AnimatedSection from '../components/AnimatedSection'
import { AverageRow } from '../components/Grid'
import { Hint, Li, Ul } from '../components/Text'
import React, { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { SearchOutlined } from '@ant-design/icons'
import util from '../util'
import WalletAddress from '../components/WalletAddress'
import { handleAddressError } from '../handler'
import Call from '../pages/Show/Call'
const { Title, Text, Paragraph } = Typography
const RequestCall = ({ caller, callback, dest, calldata: calldataB64Encoded, amount, from }) => {
  dest = util.safeNormalizedAddress(dest)
  const network = useSelector(state => state.wallet.network)
  const balances = useSelector(state => state.wallet.balances)
  const price = useSelector(state => state.wallet.price)
  const wallets = useSelector(state => state.wallet.wallets)
  const walletList = Object.keys(wallets).map(e => wallets[e]).filter(e => e.network === network)
  const selectedWallet = from && wallets[from]
  const buildAddressObject = wallet => wallet && wallet.address && ({ value: wallet.address, label: `(${wallet.name}) ${util.ellipsisAddress(util.safeOneAddress(wallet.address))}` })
  const defaultUserAddress = (walletList.length === 0 ? {} : buildAddressObject(walletList[0]))
  const [selectedAddress, setSelectedAddress] = useState(selectedWallet ? buildAddressObject(selectedWallet) : defaultUserAddress)
  const { formatted: amountFormatted, fiatFormatted: amountFiatFormatted } = util.computeBalance(amount, price)
  const isNonZeroAmount = !(new BN(amount).isZero())
  // Format: {method, parameters, comment}
  // - method: the function's signature, for example, `commit(bytes32,bytes32,bytes32)` is the signature for `function commit(bytes32 hash, bytes32 paramsHash, bytes32 verificationHash) external`;
  // - parameters: an array of name-value pairs of length correspond to the function signature. Using above example, the parameters could be `[{"name":"hash", "value":"0x1234..."},{"name":"paramsHash", "value":"0xffff..."},{"name":"verificationHash", "value":"0xffff..."}]`
  // - comment: anything the app developer wants to add to explain to the user what the app is asking for.
  const [calldata, setCalldata] = useState({})
  const [showCall, setShowCall] = useState(false)

  useEffect(() => {
    const calldataDecoded = Buffer.from(calldataB64Encoded || '', 'base64')
    try {
      const data = JSON.parse(calldataDecoded)
      setCalldata(data)
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
        <AverageRow>
          <Space direction='vertical'>
            <Title level={3}>"{caller}" wants your 1wallet to do something </Title>
            {calldata.comment && <Paragraph>Reason: {calldata.comment} </Paragraph>}
            {!calldata.comment && <Paragraph>The app did not provide any explanation </Paragraph>}
            {isNonZeroAmount &&
              <AverageRow>
                <Space direction='vertical'>
                  <Title level={3}>...and pay</Title>
                  <Title level={3}>{amountFormatted} ONE <Hint>(≈ ${amountFiatFormatted} USD)</Hint></Title>
                  <Paragraph>To: <WalletAddress showLabel address={dest} /> </Paragraph>
                </Space>
              </AverageRow>}
            <Divider />
            <Title level={3}>Technical details</Title>
            <Paragraph>Call address: <WalletAddress showLabel address={dest} /></Paragraph>
            <Paragraph>Function: {calldata.method}</Paragraph>
            <Paragraph>Parameters:</Paragraph>
            <Ul>
              {calldata?.parameters?.map((kv, i) => {
                return <Li key={`${i}-${kv.name}`}>[{i}] {kv.name}: {kv.value}</Li>
              })}
            </Ul>
          </Space>
        </AverageRow>
        <Divider />
        {from && !selectedWallet &&
          <AverageRow>
            <Space direction='vertical'>
              <Paragraph>The app wants you to use your 1wallet at this address:</Paragraph>
              <Paragraph> <WalletAddress showLabel address={from} /></Paragraph>
              <Paragraph>However, you do not have that 1wallet address in this device. Please go back to the app, and choose an 1wallet address that you own. If you do own that 1wallet address but it is not appearing in your wallets, you need restore the wallet first using "Restore" feature with your Google Authenticator.</Paragraph>
            </Space>
          </AverageRow>}
        {from && selectedWallet &&
          <AverageRow>
            <Space direction='vertical'>
              <Paragraph>Running from</Paragraph>
              <Paragraph><WalletAddress showLabel address={from} /></Paragraph>
            </Space>
          </AverageRow>}
        {!from &&
          <>
            <AverageRow>
              <Text>Select a wallet you want to use:</Text>
            </AverageRow>
            <AverageRow>
              <Select
                suffixIcon={<SearchOutlined />}
                placeholder='one1......'
                labelInValue
                bordered={false}
                showSearch
                style={{
                  width: '100%',
                  borderBottom: '1px dashed black'
                }}
                value={selectedAddress}
                onBlur={() => {}}
                onSearch={() => {}}
              >
                {walletList.map(wallet => {
                  const { address, name } = wallet
                  const oneAddress = util.safeOneAddress(address)
                  const displayText = `(${name}) ${util.ellipsisAddress(oneAddress)}`
                  return (
                    <Select.Option key={displayText} value={displayText} style={{ padding: 0 }}>
                      <Row align='left'>
                        <Col span={24}>
                          <Tooltip title={oneAddress}>
                            <Button
                              block
                              type='text'
                              style={{ textAlign: 'left', height: '50px' }}
                              onClick={() => {
                                setSelectedAddress({ value: address, label: displayText })
                              }}
                            >
                              {displayText}
                            </Button>
                          </Tooltip>
                        </Col>
                      </Row>
                    </Select.Option>
                  )
                })}
              </Select>
            </AverageRow>
          </>}
        {!showCall &&
          <AverageRow justify='space-between'>
            <Button size='large' type='text' onClick={cancel} danger>Cancel</Button>
            <Button
              type='primary' size='large' shape='round' onClick={next}
              disabled={!(selectedAddress.value)}
            >Next
            </Button>
          </AverageRow>}

      </AnimatedSection>
      {showCall &&
        <Call
          address={selectedAddress.value} show={showCall} onClose={onCallClose} onSuccess={onSuccess}
          prefillAmount={amountFormatted} prefillDest={dest} prefillData={calldata.parameters.map(e => e.value)} prefillMethod={calldata.method}
        />}
    </>
  )
}

export default RequestCall
