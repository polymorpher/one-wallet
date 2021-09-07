import { TallRow } from '../../components/Grid'
import { Col, Typography, Select, Image, Button, message, Row, Tooltip, Input, Space } from 'antd'
import React, { useCallback, useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import ONEConstants from '../../../../lib/constants'
import util from '../../util'
import { DefaultTrackedERC20, HarmonyONE } from '../../components/TokenAssets'
import api from '../../api'
import { InputBox } from '../../components/Text'
import BN from 'bn.js'
import { PercentageOutlined, QuestionCircleOutlined, SwapOutlined } from '@ant-design/icons'
import { OtpStack, useOtpState } from '../../components/OtpStack'
import { FallbackImage } from '../../constants/ui'
const { Text } = Typography

const tokenIconUrl = (symbol) => `https://res.cloudinary.com/sushi-cdn/image/fetch/w_64/https://raw.githubusercontent.com/sushiswap/icons/master/token/${symbol.toLowerCase()}.jpg`

// TODO: remove this mock exchange rate.
const mockExchangeRate = () => Math.floor(Math.random() * 100)

const textStyle = {
  paddingRight: '8px',
  display: 'block'
}

const optionButtonStyle = {
  textAlign: 'left',
  height: '48px',
}

const selectOptionStyle = {
  padding: 0
}

const maxButtonStyle = {
  marginLeft: '24px',
  bottom: '1px'
}

const tokenSelectorStyle = {
  minWidth: '160px', border: 'none', borderBottom: '1px solid lightgrey',
}

const amountInputStyle = {
  margin: 0,
  flex: 1,
  borderBottom: '1px solid lightgrey'
}

/**
 * Renders a token label for the Select Option.
 * If it is selected, display only the symbol, otherwise display symbol and name.
 */
const TokenLabel = ({ token, selected }) => (
  <Row align='middle' style={{ flexWrap: 'nowrap', width: 'fit-content' }}>
    <Image
      preview={false}
      width={24}
      height={24}
      fallback={FallbackImage}
      wrapperStyle={{ marginRight: '16px' }}
      src={tokenIconUrl(token.iconSymbol || token.symbol)}
    />
    {selected && <Text> {token.symbol.toUpperCase()} </Text>}
    {!selected && <Text style={{ fontSize: 10 }}> {token.symbol.toUpperCase()}<br />{token.name}</Text>}
  </Row>
)

/**
 * Renders exchange rate within a button that can flip the exchange rate.
 */
const ExchangeRateButton = ({ exchangeRate, selectedTokenSwapFrom, selectedTokenSwapTo }) => {
  const [flippedExchangeRate, setFlippedExchangeRate] = useState(false)

  const onFlipExchangeRate = () => {
    setFlippedExchangeRate(!flippedExchangeRate)
  }
  if (!exchangeRate) {
    return <></>
  }

  return exchangeRate && (
    <Row justify='end'>
      <Space align='center'>
        <Button block type='text' style={{ marginRight: 32 }} icon={<SwapOutlined />} onClick={onFlipExchangeRate} />
        <Text type='secondary' style={{ float: 'right' }}>
          {flippedExchangeRate
            ? (<>1 {selectedTokenSwapTo.symbol} = {util.formatNumber(1 / exchangeRate, 10)} {selectedTokenSwapFrom.symbol}</>)
            : (<>1 {selectedTokenSwapFrom.symbol} = {util.formatNumber(exchangeRate, 10)} {selectedTokenSwapTo.symbol}</>)}
        </Text>
      </Space>
    </Row>
  )
}

/**
 * Gets the supplied token balance. If the token is Harmony ONE, use the supplied wallet balance.
 * Otherwise use token balances to compute the balance.
 * @param {*} selectedToken selected token or wallet.
 * @param {*} tokenBalances all tracked token balances.
 * @param {*} oneBalance Harmony ONE wallet balance in raw format.
 * @returns computed balance.
 */
const getTokenBalance = (selectedToken, tokenBalances, oneBalance) => {
  try {
    if (selectedToken && selectedToken.symbol === HarmonyONE.symbol) {
      const computedBalance = util.computeBalance(oneBalance, 0)
      return computedBalance
    }
    const computedBalance = util.computeBalance(tokenBalances[selectedToken.address], undefined, selectedToken.decimal)
    return computedBalance
  } catch (ex) {
    console.error(ex)
    return undefined
  }
}

/**
 * Handles swap token selection. Either a "swap from" token or a "swap to" token can be handled.
 * TODO: actual exchange rate should be fetched and updated here.
 * If the selected token changes, the target swap amount will be automatically updated based on fetched exchange rate.
 */
const handleSwapTokenSelected = async ({
  token,
  shouldCalculateExchangeRate,
  swapAmountFormatted,
  setSelectedToken,
  setExchangeRate,
  setTargetSwapAmountFormatted
}) => {
  setSelectedToken({ ...token, value: token.symbol, label: <TokenLabel token={token} selected /> })

  if (shouldCalculateExchangeRate) {
    // TODO: Fetch exchange rate for token.symbol and selectedTokenSwapTo.value
    const rate = mockExchangeRate()

    setExchangeRate(rate)

    const amount = util.formatNumber(swapAmountFormatted, 4)

    const calculatedTargetAmount = util.formatNumber(amount * rate, 4)

    if (rate && !isNaN(calculatedTargetAmount)) {
      setTargetSwapAmountFormatted(calculatedTargetAmount.toString())
    }
  }
}

/**
 * Renders swap coins from ONE wallet or tracked token to another token tab.
 */
const Swap = ({ address }) => {
  const wallets = useSelector(state => state.wallet.wallets)
  const network = useSelector(state => state.wallet.network)
  const wallet = wallets[address] || {}
  const dispatch = useDispatch()

  const doubleOtp = wallet.doubleOtp
  const { state: otpState } = useOtpState()
  const { otpInput, otp2Input, resetOtp } = otpState

  const tokenBalances = wallet.tokenBalances || {}

  const harmonyToken = { ...HarmonyONE }
  const harmonySelectOption = {
    ...harmonyToken,
    value: HarmonyONE.symbol,
    label: <TokenLabel token={harmonyToken} selected />
  }

  const balances = useSelector(state => state.wallet.balances)
  const balance = balances[address] || 0

  const [pairs, setPairs] = useState([])
  const [tokens, setTokens] = useState({})
  const [fromTokens, setFromTokens] = useState([])
  const [toTokens, setToTokens] = useState([])
  const emptySelectOption = { value: '', label: '' }

  const [tokenFrom, setTokenFrom] = useState(harmonySelectOption)
  const [tokenTo, setTokenTo] = useState(emptySelectOption)
  const [fromAmountFormatted, setFromAmountFormatted] = useState()
  const [fromAmount, setFromAmount] = useState()
  const [toAmount, setToAmount] = useState()
  const [toAmountFormatted, setToAmountFormatted] = useState()
  const [tokenBalanceFormatted, setTokenBalanceFormatted] = useState('0')
  const [exchangeRate, setExchangeRate] = useState()
  const [editingSetting, setEditingSetting] = useState(false)
  const [slippageTolerance, setSlippageTolerance] = useState('0.50')
  const [transactionDeadline, setTransactionDeadline] = useState('120')

  // Loads supported tokens that are available for swap.
  useEffect(() => {
    const getPairs = async () => {
      const { pairs, tokens } = await api.sushi.getCachedTokenPairs()
      // TODO: remove restrictions for token-token swaps later
      const filteredPairs = (pairs || []).filter(e => e.t0 === ONEConstants.Sushi.WONE || e.t1 === ONEConstants.Sushi.WONE)
      setPairs(filteredPairs)
      Object.keys(tokens).forEach(addr => {
        tokens[addr].address = addr
      })
      setTokens(tokens || {})
    }
    getPairs()
  }, [])

  useEffect(() => {
    if (Object.keys(tokens).length === 0) {
      return
    }
    const erc20Tracked = (wallet.trackedTokens || []).filter(e => e.tokenType === ONEConstants.TokenType.ERC20)
    const trackedTokens = [harmonyToken, ...DefaultTrackedERC20(network), ...(erc20Tracked || [])]
    trackedTokens.forEach(tt => {
      // align formats
      tt.address = tt.address || tt.contractAddress
      tt.decimal = tt.decimal || tt.decimals
    })
    const updateFromTokens = async () => {
      const trackedTokensUpdated = await api.tokens.batchGetMetadata(trackedTokens)
      // ONE has null contractAddress
      const filteredTokens = trackedTokensUpdated.filter(t => t.contractAddress === null || tokens[t.contractAddress])

      filteredTokens.sort((t0, t1) => (t1.priority || 0) - (t0.priority || 0))
      setFromTokens(filteredTokens)
    }
    updateFromTokens()
  }, [tokens])

  useEffect(() => {
    const tokenBalance = getTokenBalance(tokenFrom, tokenBalances, balance)
    if (!tokenBalance) {
      setTokenBalanceFormatted('0')
    }
    setTokenBalanceFormatted(tokenBalance.formatted)
  }, [tokenFrom, tokenBalances, balance])

  useEffect(() => {
    if (Object.keys(tokens).length === 0) {
      return
    }
    // console.log(selectedTokenSwapFrom)
    // console.log(tokens)
    const from = tokenFrom.address || tokenFrom.contractAddress || ONEConstants.Sushi.WONE
    const tokensAsTo = pairs.filter(e => e.t0 === from).map(e => tokens[e.t1])
    const tokensAsFrom = pairs.filter(e => e.t1 === from).map(e => tokens[e.t0])
    const filteredTokens = {}
    // console.log({ tokensAsTo, tokensAsFrom })
    tokensAsTo.forEach(t => { filteredTokens[t.address] = { ...t, to: true } })
    tokensAsFrom.forEach(t => { filteredTokens[t.address] = { ...t, from: true } })
    const toTokens = Object.keys(filteredTokens).map(k => filteredTokens[k])
    // ONE can be exchanged to WONE
    if (!tokenFrom.address && !tokenFrom.contractAddress) {
      toTokens.push(tokens[ONEConstants.Sushi.WONE])
    } else {
      // any token except ONE itself can be exchanged to ONE
      toTokens.push(HarmonyONE)
    }

    toTokens.sort((t0, t1) => (t1.priority || 0) - (t0.priority || 0))
    setToTokens(toTokens)
    if (toTokens.length === 0) {
      setTokenTo(emptySelectOption)
    }
    if (!util.isONE(tokenTo) && !util.isWONE(tokenTo)) {
      if (!filteredTokens[tokenTo.address]) {
        setTokenTo(emptySelectOption)
      }
    }
  }, [tokenFrom, tokens, pairs])

  useEffect(() => {
    // console.log({ fromAmountFormatted, toAmountFormatted })
    onAmountChange(true)({ target: { value: fromAmountFormatted } })
  }, [tokenTo])

  useEffect(() => {
    // console.log({ toAmountFormatted, fromAmountFormatted })
    onAmountChange(false)({ target: { value: toAmountFormatted } })
  }, [tokenFrom])

  const buildSwapOptions = (tokens, setSelectedToken) => tokens.map((token, index) => (
    <Select.Option key={index} value={token.symbol || 'one'} style={selectOptionStyle}>
      <Button
        type='text'
        block
        style={optionButtonStyle}
        onClick={() => setSelectedToken(token)}
      >
        <TokenLabel token={token} />
      </Button>
    </Select.Option>
  ))

  // TODO - check liquidity of both tokens
  const onAmountChange = useCallback((isFrom) => async ({ target: { value, preciseValue } } = {}) => {
    // console.log({ isFrom, value, selectedTokenSwapTo, selectedTokenSwapFrom })
    const fromSetter = isFrom ? setFromAmountFormatted : setToAmountFormatted
    const toSetter = isFrom ? setToAmountFormatted : setFromAmountFormatted
    const preciseToSetter = isFrom ? setToAmount : setFromAmount
    const preciseFromSetter = isFrom ? setFromAmount : setToAmount
    fromSetter(value)
    if (preciseValue) {
      preciseFromSetter(preciseValue)
    }
    if (!util.validBalance(value, true) || parseFloat(value) === 0) {
      if (isFrom) {
        setToAmountFormatted(undefined)
        setToAmount(undefined)
      } else {
        setFromAmountFormatted(undefined)
        setFromAmount(undefined)
      }
      return
    }
    if ((util.isONE(tokenFrom) && util.isWONE(tokenTo)) || util.isWONE(tokenFrom) && util.isONE(tokenTo)) {
      setExchangeRate(1)
      toSetter(value)
      preciseValue !== undefined && preciseToSetter(preciseValue)
      return
    }
    if (!tokenTo.value) {
      setExchangeRate(undefined)
      toSetter(undefined)
      preciseToSetter(undefined)
      return
    }
    if (!preciseValue) {
      preciseFromSetter(util.toBalance(value, undefined, isFrom ? tokenFrom.decimal : tokenTo.decimal))
    }
    const useFrom = (util.isONE(tokenFrom) || util.isWONE(tokenFrom))
    const tokenAddress = useFrom ? tokenTo.address : tokenFrom.address
    const outDecimal = useFrom ? tokenTo.decimal : tokenFrom.decimal
    const inDecimal = useFrom ? tokenFrom.decimal : tokenTo.decimal
    const { balance: amountIn, formatted: amountInFormatted } = util.toBalance(value, undefined, inDecimal)
    const amountOut = await api.sushi.getAmountOut({ amountIn, tokenAddress, inverse: useFrom !== isFrom })

    const { formatted: amountOutFormatted } = util.computeBalance(amountOut, undefined, outDecimal)
    toSetter(amountOutFormatted)
    preciseToSetter(amountOut)
    // console.log({ useFrom, amountOutFormatted, amountInFormatted, inDecimal, outDecimal, amountOut: amountOut.toString(), amountIn: amountIn.toString() })
    let exchangeRate = parseFloat(amountOutFormatted) / parseFloat(amountInFormatted)
    if (!isFrom) {
      exchangeRate = 1 / exchangeRate
    }
    setExchangeRate(exchangeRate)
  }, [setExchangeRate, tokenTo, tokenFrom, setToAmountFormatted, setFromAmountFormatted])

  const setMaxSwapAmount = useCallback(() => {
    const { balance: tokenBalance, formatted } = getTokenBalance(tokenFrom, tokenBalances, balance)
    setFromAmountFormatted(formatted || '0')
    setFromAmount(tokenBalance)
    onAmountChange(true)({ target: { value: formatted, preciseValue: tokenBalance } })
  }, [tokenFrom, balance, tokenBalances, onAmountChange, setFromAmountFormatted])

  const onSelectTokenSwapFrom = (token) => {
    setTokenFrom({ ...token, value: token.symbol, label: <TokenLabel token={token} selected /> })
    // onAmountChange(false)({ target: { value: targetSwapAmountFormatted } })
  }

  const onSelectTokenSwapTo = (token) => {
    setTokenTo({ ...token, value: token.symbol, label: <TokenLabel token={token} selected /> })
    // onAmountChange(true)({ target: { value: swapAmountFormatted } })
  }

  // TODO: this is not implemented, we need to check slippage tolerance and transaction deadline etc.
  const confirmSwap = useCallback(() => {
    // const { balance: fromBalance } = util.toBalance(fromAmountFormatted, undefined, selectedTokenSwapFrom.decimal)
    const { balance: tokenBalance, formatted: tokenBalanceFormatted } = getTokenBalance(tokenFrom, tokenBalances, balance)

    if (!(new BN(tokenBalance).gte(new BN(fromAmount)))) {
      // console.log(new BN(tokenBalance).toString())
      // console.log(new BN(fromAmount).toString())
      message.error(`Insufficient balance (got ${tokenBalanceFormatted}, need ${fromAmountFormatted})`)
      return
    }
    // TODO: actual swapping functionalities.
    // console.log(`swapping [${fromAmountFormatted}] from [${tokenFrom.name}] to [${tokenTo.name}]`)
  }, [tokenFrom, tokenTo, tokenBalances, balance, fromAmountFormatted, toAmountFormatted])

  const swapAllowed =
    tokenFrom.value !== '' &&
    tokenTo.value !== '' &&
    fromAmountFormatted !== '' && !isNaN(fromAmountFormatted) &&
    toAmountFormatted !== '' && !isNaN(toAmountFormatted)

  return (
    <>
      <TallRow>
        <Row align='middle' style={{ width: '100%' }} gutter={32}>
          <Col span={8}>
            <Text style={textStyle} type='secondary'>From</Text>
          </Col>
          <Col span={16}>
            <Text style={textStyle} type='secondary'>Amount (Balance: {tokenBalanceFormatted})</Text>
          </Col>
        </Row>
        <Row align='middle' style={{ width: '100%' }} gutter={32}>
          <Col span={8}>
            <Select
              showSearch
              bordered={false}
              labelInValue
              style={tokenSelectorStyle}
              value={tokenFrom}
              onSearch={(value) => { setTokenFrom({ value }) }}
            >
              {buildSwapOptions(fromTokens, onSelectTokenSwapFrom)}
            </Select>
          </Col>
          <Col span={16}>
            <Row>
              <InputBox size='default' style={amountInputStyle} placeholder='0.00' value={fromAmountFormatted} onChange={onAmountChange(true)} />
              <Button style={maxButtonStyle} shape='round' onClick={setMaxSwapAmount}>Max</Button>
            </Row>
          </Col>
        </Row>
      </TallRow>
      <TallRow>
        <Row align='middle' style={{ width: '100%' }}>
          <Col span={8}>
            <Text style={textStyle} type='secondary'>To</Text>
          </Col>
          <Col span={16}>
            <Text style={textStyle} type='secondary'>Expected Amount</Text>
          </Col>
        </Row>
        <Row align='middle' style={{ width: '100%' }}>
          <Col span={8}>
            <Select
              showSearch
              bordered={false}
              labelInValue
              style={tokenSelectorStyle}
              value={tokenTo}
              onSearch={(value) => { setTokenTo({ value }) }}
            >
              {buildSwapOptions(toTokens, onSelectTokenSwapTo)}
            </Select>
          </Col>
          <Col span={16}>
            <InputBox size='default' style={{ ...amountInputStyle, width: '100%' }} placeholder='0.00' value={toAmountFormatted} onChange={onAmountChange(false)} />
          </Col>
        </Row>
      </TallRow>
      <TallRow align='middle'>
        <Col span={24}>
          <ExchangeRateButton exchangeRate={exchangeRate} selectedTokenSwapFrom={tokenFrom} selectedTokenSwapTo={tokenTo} />
        </Col>
      </TallRow>
      <TallRow>
        <OtpStack walletName={wallet.name} doubleOtp={doubleOtp} otpState={otpState} />
      </TallRow>
      <TallRow justify='space-between' align='baseline'>
        <Space size='large' align='top'>
          <Button type='link' size='large' style={{ padding: 0 }} onClick={() => setEditingSetting(!editingSetting)}>{editingSetting ? 'Close' : 'Advanced Settings'}</Button>
        </Space>

        <Button
          shape='round'
          disabled={!swapAllowed}
          type='primary'
          onClick={confirmSwap}
        >
          Confirm
        </Button>
      </TallRow>
      <TallRow align='top'>
        {editingSetting &&
          <Space direction='vertical' size='large'>
            <Space>
              <Text style={textStyle}>
                Slippage tolerance &nbsp;
                <Tooltip title='Your transaction will revert if price changes unfavorable by more than this percentage'>
                  <QuestionCircleOutlined />
                </Tooltip>
              </Text>
              {/* TODO: there is no validation for the value yet */}
              <Input addonAfter={<PercentageOutlined />} placeholder='0.0' value={slippageTolerance} onChange={({ target: { value } }) => setSlippageTolerance(value)} />
            </Space>
            <Space>
              <Text style={textStyle}>
                Transaction deadline &nbsp;
                <Tooltip title='Your transaction will revert if it is pending for more than this long'>
                  <QuestionCircleOutlined />
                </Tooltip>
              </Text>
              {/* TODO: there is no validation for the value yet */}
              <Input addonAfter='seconds' placeholder='0' value={transactionDeadline} onChange={({ target: { value } }) => setTransactionDeadline(value)} />
            </Space>
          </Space>}
      </TallRow>
    </>
  )
}

export default Swap
