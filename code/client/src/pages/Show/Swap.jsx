import { TallRow } from '../../components/Grid'
import { Col, Typography, Select, Image, Button, message, Row, Tooltip, Input, Space } from 'antd'
import React, { useCallback, useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import ONEConstants from '../../../../lib/constants'
import util from '../../util'
import { DefaultTrackedERC20, HarmonyONE, withKeys } from '../../components/TokenAssets'
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
      src={tokenIconUrl(token.symbol)}
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

  return (
    <>
      {
        exchangeRate
          ? (
            <Button block type='text' style={{ padding: '0 35px 0 0', textAlign: 'left' }} onClick={onFlipExchangeRate}>
              <Text type='secondary'>
                Exchange Rate
              </Text>
              <Text type='secondary' style={{ float: 'right' }}>
                {
                  flippedExchangeRate
                    ? (
                      <>
                        1 {selectedTokenSwapTo.symbol} = {1 / exchangeRate} {selectedTokenSwapFrom.symbol} <SwapOutlined />
                      </>
                      )
                    : (
                      <>
                        1 {selectedTokenSwapFrom.symbol} = {exchangeRate} {selectedTokenSwapTo.symbol} <SwapOutlined />
                      </>
                      )
                }
              </Text>
            </Button>
            )
          : <></>
      }
    </>
  )
}

/**
 * Gets the supplied token balance. If the token is Harmony ONE, use the supplied wallet balance.
 * Otherwise use token balances to compute the balance.
 * @param {*} selectedToken selected token or wallet.
 * @param {*} tokenBalances all tracked token balances.
 * @param {*} oneWalletBalance Harmony ONE wallet balance in raw format.
 * @returns computed balance.
 */
const getSelectedTokenComputedBalance = (selectedToken, tokenBalances, oneWalletBalance) => {
  try {
    if (selectedToken && selectedToken.symbol === HarmonyONE.symbol) {
      const computedBalance = util.computeBalance(oneWalletBalance, 0)

      return computedBalance
    }

    const computedBalance = util.computeBalance(tokenBalances[selectedToken.address], undefined, selectedToken.decimals)

    return computedBalance
  } catch (ex) {
    console.error(ex)
    return undefined
  }
}

/**
 * Handles a swap amount change, it can be either swap amount or target swap amount.
 * A swap amount or target swap amount is automatically set based on the provided exchange rate.
 */
const handleSwapAmountChange = ({
  value,
  exchangeRate,
  setSwapAmountFunc,
  setCalculatedAmountFunc
}) => {
  if (isNaN(value)) {
    setSwapAmountFunc(undefined)
  } else {
    const amount = util.formatNumber(value, 4)

    setSwapAmountFunc(value)

    const calculatedAmount = util.formatNumber(amount * exchangeRate, 4)

    if (exchangeRate && !isNaN(calculatedAmount)) {
      setCalculatedAmountFunc(calculatedAmount.toString())
    }
  }
}

/**
 * Handles swap token selection. Either a "swap from" token or a "swap to" token can be handled.
 * TODO: actual exchange rate should be fetched and updated here.
 * If the selected token changes, the target swap amount will be automatically updated based on fetched exchange rate.
 */
const handleSwapTokenSelected = ({
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
  const trackedTokens = (wallet.trackedTokens || []).filter(e => e.tokenType === ONEConstants.TokenType.ERC20)
  const harmonyToken = { ...HarmonyONE }
  const harmonySelectOption = {
    ...harmonyToken,
    value: HarmonyONE.symbol,
    label: <TokenLabel token={harmonyToken} selected />
  }
  const defaultTrackedTokens = withKeys(DefaultTrackedERC20(network))
  const [currentTrackedTokens, setCurrentTrackedTokens] = useState([harmonyToken, ...defaultTrackedTokens, ...(trackedTokens || [])])
  const balances = useSelector(state => state.wallet.balances)
  const balance = balances[address] || 0

  const [pairs, setPairs] = useState([])
  const [tokens, setTokens] = useState({})
  const [targetTokens, setTargetTokens] = useState([])

  const [selectedTokenSwapFrom, setSelectedTokenSwapFrom] = useState(harmonySelectOption)
  const [selectedTokenSwapTo, setSelectedTokenSwapTo] = useState({ value: '', label: '' })
  const [swapAmountFormatted, setSwapAmountFormatted] = useState()
  const [targetSwapAmountFormatted, setTargetSwapAmountFormatted] = useState()
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
    const loadTrackedTokensMetadata = async () => {
      const trackedTokensWithMetadata = await Promise.all(currentTrackedTokens.map(async (trackedToken) => {
        try {
          if (trackedToken.symbol === HarmonyONE.symbol) {
            return trackedToken
          }
          const { name, symbol, decimals } = await api.blockchain.getTokenMetadata(trackedToken)
          return {
            ...trackedToken,
            name,
            symbol,
            decimals
          }
        } catch (ex) {
          console.error(ex)
        }
      }))
      setCurrentTrackedTokens(trackedTokensWithMetadata)
    }
    loadTrackedTokensMetadata()
  }, [])

  useEffect(() => {
    const tokenBalance = getSelectedTokenComputedBalance(selectedTokenSwapFrom, tokenBalances, balance)
    if (!tokenBalance) {
      setTokenBalanceFormatted('0')
    }
    setTokenBalanceFormatted(tokenBalance.formatted)
  }, [selectedTokenSwapFrom, tokenBalances, balance])

  useEffect(() => {
    if (Object.keys(tokens).length === 0) {
      return
    }
    console.log(selectedTokenSwapFrom)
    console.log(tokens)
    const from = selectedTokenSwapFrom.address || ONEConstants.Sushi.WONE
    const tokensAsTo = pairs.filter(e => e.t0 === from).map(e => tokens[e.t1])
    const tokensAsFrom = pairs.filter(e => e.t1 === from).map(e => tokens[e.t0])
    const filteredTokens = {}
    console.log({ tokensAsTo, tokensAsFrom })
    tokensAsTo.forEach(t => {
      filteredTokens[t.address] = { ...t, to: true }
    })
    tokensAsFrom.forEach(t => {
      filteredTokens[t.address] = { ...t, from: true }
    })
    setTargetTokens(Object.keys(filteredTokens).map(k => filteredTokens[k]))
  }, [selectedTokenSwapFrom, tokens, pairs])

  const buildSwapOptions = (tokens, setSelectedToken) => tokens.map((token, index) => (
    <Select.Option key={index} value={token.contractAddress || ONEConstants.Sushi.WONE} style={selectOptionStyle}>
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

  const handleSearchSupportedTokens = async (value) => { setSelectedTokenSwapTo({ value }) }

  const handleSearchCurrentTrackedTokens = async (value) => { setSelectedTokenSwapFrom({ value }) }

  const onSelectTokenSwapFrom = (token) => {
    handleSwapTokenSelected({
      token,
      swapAmountFormatted,
      setExchangeRate,
      setTargetSwapAmountFormatted,
      shouldCalculateExchangeRate: selectedTokenSwapTo.value !== '',
      setSelectedToken: setSelectedTokenSwapFrom,
    })
  }

  const onSelectTokenSwapTo = (token) => {
    handleSwapTokenSelected({
      token,
      swapAmountFormatted,
      setExchangeRate,
      setTargetSwapAmountFormatted,
      shouldCalculateExchangeRate: selectedTokenSwapFrom.value !== '',
      setSelectedToken: setSelectedTokenSwapTo,
    })
  }

  const onSwapAmountChange = useCallback((value) => {
    handleSwapAmountChange({
      value,
      exchangeRate,
      setSwapAmountFunc: setSwapAmountFormatted,
      setCalculatedAmountFunc: setTargetSwapAmountFormatted
    })
  }, [exchangeRate, setTargetSwapAmountFormatted, setSwapAmountFormatted])

  const onTargetSwapAmountChange = useCallback((value) => {
    handleSwapAmountChange({
      value,
      exchangeRate: 1 / exchangeRate,
      setSwapAmountFunc: setTargetSwapAmountFormatted,
      setCalculatedAmountFunc: setSwapAmountFormatted
    })
  }, [exchangeRate, setTargetSwapAmountFormatted, setSwapAmountFormatted])

  const setMaxSwapAmount = useCallback(() => {
    const tokenBalance = getSelectedTokenComputedBalance(selectedTokenSwapFrom, tokenBalances, balance)

    const amount = tokenBalance ? tokenBalance.formatted : '0'

    handleSwapAmountChange({
      exchangeRate,
      value: amount,
      setSwapAmountFunc: setSwapAmountFormatted,
      setCalculatedAmountFunc: setTargetSwapAmountFormatted
    })
  }, [exchangeRate, setSwapAmountFormatted, setTargetSwapAmountFormatted])

  // TODO: this is not implemented, we need to check slippage tolerance and transaction deadline etc.
  const confirmSwap = useCallback(() => {
    const swapAmountBalance = util.toBalance(swapAmountFormatted)
    const computedTokenBalance = getSelectedTokenComputedBalance(selectedTokenSwapFrom, tokenBalances, balance)
    const tokenBalanceBn = new BN(computedTokenBalance.balance)
    const swapAmountBn = new BN(swapAmountBalance.balance)

    if (swapAmountBalance && tokenBalanceBn.gte(swapAmountBn)) {
      // TODO: actual swapping functionalities.
      console.log(`swapping [${swapAmountFormatted}] from [${selectedTokenSwapFrom.name}] to [${selectedTokenSwapTo.name}]`)
    } else {
      message.error('Not enough balance to swap')
    }
  }, [selectedTokenSwapFrom, selectedTokenSwapTo, tokenBalances, balance, swapAmountFormatted])

  const swapAllowed =
    selectedTokenSwapFrom.value !== '' &&
    selectedTokenSwapTo.value !== '' &&
    swapAmountFormatted !== '' && !isNaN(swapAmountFormatted) &&
    targetSwapAmountFormatted !== '' && !isNaN(targetSwapAmountFormatted)

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
              value={selectedTokenSwapFrom}
              onSearch={handleSearchCurrentTrackedTokens}
            >
              {buildSwapOptions(currentTrackedTokens, onSelectTokenSwapFrom)}
            </Select>
          </Col>
          <Col span={16}>
            <Row>
              <InputBox size='default' style={amountInputStyle} placeholder='0.00' value={swapAmountFormatted} onChange={({ target: { value } }) => onSwapAmountChange(value)} />
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
              value={selectedTokenSwapTo}
              onSearch={handleSearchSupportedTokens}
            >
              {buildSwapOptions(targetTokens, onSelectTokenSwapTo)}
            </Select>
          </Col>
          <Col span={16}>
            <InputBox size='default' style={{ ...amountInputStyle, width: '100%' }} placeholder='0.00' value={targetSwapAmountFormatted} onChange={({ target: { value } }) => onTargetSwapAmountChange(value)} />
          </Col>
        </Row>
      </TallRow>
      <TallRow align='middle'>
        <Col span={24}>
          <ExchangeRateButton exchangeRate={exchangeRate} selectedTokenSwapFrom={selectedTokenSwapFrom} selectedTokenSwapTo={selectedTokenSwapTo} />
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
