import { Button, Space, Typography } from 'antd'
import message from '../message'
import BN from 'bn.js'
import AnimatedSection from '../components/AnimatedSection'
import { AverageRow } from '../components/Grid'
import { Hint } from '../components/Text'
import React, { useState } from 'react'
import { useSelector } from 'react-redux'
import util from '../util'
import WalletAddress from '../components/WalletAddress'
import Send from '../pages/Show/Send'
import { handleAddressError } from '../handler'
import { HarmonyONE } from '../components/TokenAssets'
import { WalletSelector } from './Common'
const { Title, Paragraph } = Typography
const RequestPayment = ({ caller, callback, amount, dest, from }) => {
  dest = util.safeNormalizedAddress(dest)
  const balances = useSelector(state => state.balance)
  const price = useSelector(state => state.global.price)
  const [selectedAddress, setSelectedAddress] = useState({})
  const { formatted: amountFormatted, fiatFormatted: amountFiatFormatted } = util.computeBalance(amount, price)

  const [showSend, setShowSend] = useState(false)

  const next = () => {
    if (!selectedAddress.value) {
      return message.error('No address is selected')
    }
    const normalizedAddress = util.safeExec(util.normalizedAddress, [selectedAddress.value], handleAddressError)
    if (!normalizedAddress) {
      return message.error(`normalizedAddress=${normalizedAddress}`)
    }
    const balance = balances[selectedAddress.value]
    if (amount && !(new BN(amount).lte(new BN(balance)))) {
      const { formatted: balanceFormatted } = util.computeBalance(balance)
      return message.error(`Insufficient balance (${balanceFormatted} ONE) in the selected wallet`)
    }
    setShowSend(true)
  }
  const cancel = () => {
    window.location.href = callback + '?success=0'
  }
  const onSendClose = () => {
    setShowSend(false)
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
            <Title level={3}>"{caller}" wants you to pay</Title>
            {amount && <Title level={3}>{amountFormatted} ONE <Hint>(≈ ${amountFiatFormatted} USD)</Hint></Title>}
            <Paragraph>To: <WalletAddress showLabel address={dest} /></Paragraph>
          </Space>
        </AverageRow>
        <WalletSelector from={from} onAddressSelected={setSelectedAddress} />
        {!showSend &&
          <AverageRow justify='space-between'>
            <Button size='large' type='text' onClick={cancel} danger>Cancel</Button>
            <Button
              type='primary' size='large' shape='round' onClick={next}
              disabled={!(selectedAddress.value)}
            >Next
            </Button>
          </AverageRow>}

      </AnimatedSection>
      {showSend &&
        <Send
          address={selectedAddress.value} show={showSend} onClose={onSendClose} onSuccess={onSuccess}
          prefillAmount={amount && amountFormatted} prefillDest={dest} overrideToken={HarmonyONE}
        />}
    </>
  )
}

export default RequestPayment
