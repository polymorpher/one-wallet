import React, { useCallback, useEffect, useState } from 'react'
import { Button, Col, Row, Space, Spin, Typography } from 'antd'
import api from '../../api'
import util, { useWindowDimensions } from '../../util'
import ONEUtil from '../../../../lib/util'
import ONENames from '../../../../lib/names'
import { useDispatch, useSelector } from 'react-redux'
import { AutoResizeInputBox, Warning, Hint } from '../../components/Text'
import { walletActions } from '../../state/modules/wallet'
import AnimatedSection from '../../components/AnimatedSection'
import { CheckCircleOutlined, CloseOutlined, LoadingOutlined } from '@ant-design/icons'
import BN from 'bn.js'
import { CommitRevealProgress } from '../../components/CommitRevealProgress'

const { Text, Title, Link } = Typography

const inputStyle = {
  display: 'inline',
  margin: '0 8px',
  padding: 0,
  textAlign: 'center',
}

const priceRowStyle = {
  textAlign: 'center',
  marginBottom: 32
}

const inputRowStyle = {
  marginTop: '32px',
  marginBottom: '48px',
  alignItems: 'baseline',
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

const prepareName = (name) => {
  if (!name) {
    name = `${ONENames.randomWord()} ${ONENames.randomWord()} ${ONENames.randomWord()}`
  }
  if (name.indexOf(' ') < 0) {
    name = `${name} ${ONENames.randomWord()} ${ONENames.randomWord()}`
  }
  name = name.replaceAll(' ', '-').toLowerCase()
  return name
}

/**
 * Renders Purchase Domain section that enables users to purchase an available domain for their selected wallet using selected token.
 */
const PurchaseDomain = ({ show, address, onClose }) => {
  const dispatch = useDispatch()
  const balances = useSelector(state => state.wallet.balances)
  const wallets = useSelector(state => state.wallet.wallets)
  const wallet = wallets[address] || {}
  const oneBalance = balances[address] || 0
  const [domainName, setDomainName] = useState(prepareName(wallet.name))
  const [purchaseOnePrice, setPurchaseOnePrice] = useState(0)
  const [domainFiatPrice, setDomainFiatPrice] = useState(0)
  const [available, setAvailable] = useState(false)
  const [enoughBalance, setEnoughBalance] = useState(false)
  const [domainAvailable, setDomainAvailable] = useState(false)
  const [checkingAvailability, setCheckingAvailability] = useState(true)
  const price = useSelector(state => state.wallet.price)
  const validatedDomain = validDomain(domainName)

  const [stage, setStage] = useState(-1)

  const purchaseDomain = useCallback(async () => {
    // The validated domain will be sent as [selectedDomainName].crazy.one.
    // TODO: @Arron please remove or move this to appropriate location.
    dispatch(walletActions.purchaseDomain({ domainName: validatedDomain, address }))
    onClose()
  }, [domainName, address])

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
  const { isMobile } = useWindowDimensions()
  const titleLevel = isMobile ? 4 : 3
  return (
    <AnimatedSection
      style={{ width: 720 }}
      show={show} title={<Title level={2}>Get Domain</Title>} extra={[
        <Button key='close' type='text' icon={<CloseOutlined />} onClick={onClose} />
      ]}
    >
      <Row>
        <Hint>
          Send and receive cryptos with your unique domain name. Starting from only 1 ONE.
        </Hint>
      </Row>
      <Row style={inputRowStyle} justify='center'>
        <AutoResizeInputBox extraWidth={16} style={inputStyle} value={domainName} onChange={({ target: { value } }) => setDomainName(value)} />
        <Text>{oneDomain}</Text>
      </Row>
      <Row style={priceRowStyle} justify='center'>
        <Space direction='vertical' style={{ minWidth: 275 }}>
          <Space align='baseline' style={{ justifyContent: 'space-between', width: '100%' }}>
            <Title level={titleLevel} style={{ marginRight: isMobile ? 16 : 48 }}>Cost</Title>
            <Title level={titleLevel}><span style={{ opacity: 0 }}>≈ $</span>{purchaseOnePrice.formatted || '...'}</Title><Text type='secondary'>ONE</Text>
          </Space>
          <Space align='baseline' style={{ justifyContent: 'space-between', width: '100%' }}>
            <Title level={titleLevel} style={{ marginRight: isMobile ? 16 : 48, opacity: 0 }}>Cost</Title>
            <Title style={{ whiteSpace: 'nowrap' }} level={titleLevel}><span>≈ $</span>{domainFiatPrice}</Title><Text type='secondary'>USD</Text>
          </Space>
        </Space>
      </Row>
      <Row>
        <Hint>Shorter names are more expensive. Learn more at <Link target='_blank' href='https://blog.harmony.one/harmony-community-launches-crazy-one-the-first-subdomain-nft/' rel='noreferrer'>Harmony blog</Link></Hint>
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

      <Row justify='end' style={{ marginTop: 24 }}>
        <Space>
          {stage >= 0 && stage < 3 && <LoadingOutlined />}
          {stage === 3 && <CheckCircleOutlined />}
          <Button type='primary' size='large' shape='round' disabled={!available || stage >= 0} onClick={purchaseDomain}>Buy Now</Button>
        </Space>
      </Row>
      <CommitRevealProgress stage={stage} style={{ marginTop: 32 }} />
    </AnimatedSection>
  )
}

export default PurchaseDomain
