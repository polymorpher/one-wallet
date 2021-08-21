import React, { useCallback, useEffect, useState } from 'react'
import { Button, Col, Row, Space, Spin, Typography } from 'antd'
import api from '../../api'
import util from '../../util'
import ONEUtil from '../../../../lib/util'
import { useDispatch, useSelector } from 'react-redux'
import { InputBox, Warning } from '../../components/Text'
import { walletActions } from '../../state/modules/wallet'
import AnimatedSection from '../../components/AnimatedSection'
import { CloseOutlined } from '@ant-design/icons'
import BN from 'bn.js'

const { Text, Title } = Typography

const inputStyle = {
  display: 'inline',
  margin: 0,
  padding: 0,
  width: '100%',
  textAlign: 'right'
}

const priceRowStyle = {
  textAlign: 'center'
}

const inputRowStyle = {
  paddingBottom: '32px'
}

const WarningTextStyle = {
  textAlign: 'center',
  margin: '24px 0',
  display: 'block'
}

const minDomainNameLength = 3

const delayCheckMillis = 1300

const oneDomain = '.crazy.one'

/**
 * A valid domain is more than [minDomainNameLength] and able to be normalized.
 */
const validDomain = (domainName) => {
  try {
    if (domainName.length < minDomainNameLength) {
      return undefined
    }

    return ONEUtil.normalizeDomain(`${domainName}${oneDomain}`)
  } catch (e) {
    return undefined
  }
}

/**
 * Custom hook that executes a function with delay and cancellation, if the useEffect is destroyed due to the dependencies
 * update, the timeout is cancelled, which cancels the function execution.
 * The function only runs when the supplied condition is true.
 */
const useWaitExecution = (func, runCondition, wait, dependencies) => {
  useEffect(() => {
    let timeout
    if (runCondition) {
      timeout = setTimeout(func, wait)
    }

    return () => {
      clearTimeout(timeout)
    }
  }, dependencies)
}

/**
 * Renders warning message block for the ability to purchase a domain based on the domain availability and balance availability.
 */
const WarningMessageBlock = ({ enoughBalance, domainAvailable, checkingAvailability, validatedDomain }) => (
  <Space direction='vertical' style={WarningTextStyle}>
    {
      !enoughBalance && !checkingAvailability ? <Warning>Not enough ONE balance</Warning> : <></>
    }
    {
      !domainAvailable && !checkingAvailability ? <Warning>Domain is not available</Warning> : <></>
    }
    {
      checkingAvailability && validatedDomain ? <Spin /> : <></>
    }
  </Space>
)

/**
 * Renders Purchase Domain section that enables users to purchase an available domain for their selected wallet using selected token.
 */
const PurchaseDomain = ({ show, oneBalance, walletAddress, onClose }) => {
  const dispatch = useDispatch()

  const [domainName, setDomainName] = useState('')

  const [purchaseOnePrice, setPurchaseOnePrice] = useState(0)

  const [domainFiatPrice, setDomainFiatPrice] = useState(0)

  const [available, setAvailable] = useState(false)

  const [enoughBalance, setEnoughBalance] = useState(false)

  const [domainAvailable, setDomainAvailable] = useState(false)

  const [checkingAvailability, setCheckingAvailability] = useState(true)

  const price = useSelector(state => state.wallet.price)

  const validatedDomain = validDomain(domainName)

  const purchaseDomain = useCallback(async () => {
    // The validated domain will be sent as [selectedDomainName].crazy.one.
    // TODO: @Arron please remove or move this to appropriate location.
    dispatch(walletActions.purchaseDomain({ domainName: validatedDomain, address: walletAddress }))
    onClose()
  }, [domainName, walletAddress])

  useWaitExecution(
    async () => {
      setCheckingAvailability(true)

      const domainOnePrice = await api.blockchain.domain.price({ name: domainName })

      const domainAvailability = await api.blockchain.domain.available({ name: domainName })

      const computedDomainOnePrice = util.computeBalance(domainOnePrice.toString(), price)

      const hasEnoughBalance = new BN(domainOnePrice.toString()).lte(new BN(oneBalance))

      const domainAvailableAndValid = domainAvailability && validatedDomain

      setPurchaseOnePrice({ formatted: computedDomainOnePrice.formatted, value: domainOnePrice.toString() })

      setDomainFiatPrice(computedDomainOnePrice.fiatFormatted)

      setEnoughBalance(hasEnoughBalance)

      setDomainAvailable(domainAvailableAndValid)

      setAvailable(domainAvailableAndValid && hasEnoughBalance)

      setCheckingAvailability(false)
    },
    validatedDomain,
    delayCheckMillis,
    [domainName, validatedDomain]
  )

  useEffect(() => {
    if (!validatedDomain) {
      setEnoughBalance(false)

      setDomainAvailable(false)

      setAvailable(false)

      setCheckingAvailability(true)

      setPurchaseOnePrice({ formatted: '0', value: '0' })

      setDomainFiatPrice('0')
    }
  }, [validatedDomain, setEnoughBalance, setDomainAvailable, setAvailable, setPurchaseOnePrice, setDomainFiatPrice])

  const onDomainName = (e) => {
    setDomainName(e.target.value)
  }

  return (
    <AnimatedSection
      style={{ width: 720 }}
      show={show} title={<Title level={2}>Purchase Domain</Title>} extra={[
        <Button key='close' type='text' icon={<CloseOutlined />} onClick={onClose} />
      ]}
    >
      <Row style={inputRowStyle} justify='center'>
        <Col span={6}>
          <InputBox style={inputStyle} value={domainName} onChange={onDomainName} />
        </Col>
        <Col span={6}>
          <Text>{oneDomain}</Text>
        </Col>
      </Row>
      <Row style={priceRowStyle} justify='center'>
        <Col span={12}>
          <Title level={4}>Price: {purchaseOnePrice.formatted} ONE</Title>
        </Col>
        <Col span={12}>
          <Title level={4}>
            &#8776; ${domainFiatPrice} <Text type='secondary'>USD</Text>
          </Title>
        </Col>
      </Row>
      <Row justify='center'>
        <Col span={20}>
          <Text type='secondary'>
            Other people can use this domain name to identify your wallet and make transfer. The shorter the name is, the more expensive it would be.
          </Text>
        </Col>
      </Row>
      <Row>
        <Col span={24}>
          <WarningMessageBlock
            key='error-message'
            enoughBalance={enoughBalance}
            domainAvailable={domainAvailable}
            checkingAvailability={checkingAvailability}
            validatedDomain={validatedDomain}
          />
        </Col>
      </Row>
      <Row justify='end'>
        <Col span={6}>
          <Button
            key='submit'
            type='primary'
            onClick={purchaseDomain}
            disabled={!available}
          >
            Buy Now
          </Button>
        </Col>
      </Row>
    </AnimatedSection>
  )
}

export default PurchaseDomain
