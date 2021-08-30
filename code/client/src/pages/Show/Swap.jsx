import { TallRow } from '../../components/Grid'
import { Col, Typography, Select, Image, Button, message, Row, Tooltip, Input } from 'antd'
import React, { useCallback, useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { mockCryptos } from './mock-cryptos'
import ONEConstants from '../../../../lib/constants'
import util from '../../util'
import { DefaultTrackedERC20, HarmonyONE, withKeys } from '../../components/TokenAssets'
import api from '../../api'
import { InputBox } from '../../components/Text'
import BN from 'bn.js'
import { CloseOutlined, PercentageOutlined, QuestionCircleOutlined, SettingOutlined, SwapOutlined } from '@ant-design/icons'
const { Text } = Typography

// TODO: some token's images are not available, we may want a CDN or other service that can retrieve icons dynamically.
const cryptoIconUrl = (symbol) => `https://qokka-public.s3-us-west-1.amazonaws.com/crypto-logos/${symbol.toLowerCase()}.png`

// TODO: remove this mock exchange rate.
const mockExchangeRate = () => Math.floor(Math.random() * 100)

const textStyle = {
  paddingRight: '10px',
  display: 'block'
}

const optionButtonStyle = {
  textAlign: 'left',
  height: '50px'
}

const selectOptionStyle = {
  padding: 0
}

const maxButtonStyle = {
  marginLeft: '20px',
  bottom: '1px'
}

const amountInputStyle = {
  margin: 0
}

/**
 * Renders a token label for the Select Option.
 * If it is selected, display only the symbol, otherwise display symbol and name.
 */
const TokenLabel = ({ token, selected }) => (
  <>
    <Image
      preview={false}
      width={24}
      height={24}
      wrapperStyle={{ marginRight: '15px' }}
      style={{ display: 'inline' }}
      src={cryptoIconUrl(token.symbol)}
    />
    <Text>
      {
        selected ? token.symbol : `${token.symbol} ${token.name}`
      }
    </Text>
  </>
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
  const tokenBalances = wallet.tokenBalances || {}
  const trackedTokens = (wallet.trackedTokens || []).filter(e => e.tokenType === ONEConstants.TokenType.ERC20)
  const harmonyToken = {
    name: HarmonyONE.name,
    icon: HarmonyONE.icon,
    symbol: HarmonyONE.symbol
  }
  const harmonySelectOption = {
    ...harmonyToken,
    value: HarmonyONE.symbol,
    label: <TokenLabel token={harmonyToken} selected />
  }
  const defaultTrackedTokens = withKeys(DefaultTrackedERC20(network))
  const [currentTrackedTokens, setCurrentTrackedTokens] = useState([harmonyToken, ...defaultTrackedTokens, ...(trackedTokens || [])])
  const balances = useSelector(state => state.wallet.balances)
  const balance = balances[address] || 0
  const [supportedTokens, setSupportedTokens] = useState([])
  const [selectedTokenSwapFrom, setSelectedTokenSwapFrom] = useState(harmonySelectOption)
  const [selectedTokenSwapTo, setSelectedTokenSwapTo] = useState({ value: '', label: '' })
  const [swapAmountFormatted, setSwapAmountFormatted] = useState()
  const [targetSwapAmountFormatted, setTargetSwapAmountFormatted] = useState()
  const [selectedTokenBalance, setSelectedTokenBalance] = useState('0')
  const [exchangeRate, setExchangeRate] = useState()
  const [editingSetting, setEditingSetting] = useState(false)
  const [slippageTolerance, setSlippageTolerance] = useState('0.50')
  const [transactionDeadline, setTransactionDeadline] = useState('30')

  // Loads supported tokens that are available for swap.
  useEffect(() => {
    const loadCryptos = async () => {
      // TODO: this is not tokens supported by Harmony network, fetch supported tokens from Harmony network.
      const loadedCryptos = await mockCryptos()
      setSupportedTokens(loadedCryptos)
    }

    loadCryptos()
  }, [setSupportedTokens])

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
      setSelectedTokenBalance('0')
    }

    setSelectedTokenBalance(tokenBalance.formatted)
  }, [selectedTokenSwapFrom, tokenBalances, balance])

  const swapOptions = (tokens, setSelectedToken) => tokens.map((token, index) => (
    <Select.Option key={index} value={`${token.symbol} ${token.name}`} style={selectOptionStyle}>
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

  const handleSearchSupportedTokens = async (value) => {
    setSelectedTokenSwapTo({ value })
  }

  const handleSearchCurrentTrackedTokens = async (value) => {
    setSelectedTokenSwapFrom({ value })
  }

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
      <Row align='bottom'>
        <Col span={2}>
          <Tooltip title='Setting'>
            <Button type='text' size='large' icon={editingSetting ? <CloseOutlined /> : <SettingOutlined />} onClick={() => setEditingSetting(!editingSetting)} />
          </Tooltip>
        </Col>
        {
          editingSetting
            ? (
              <>
                <Col span={8}>
                  <Text style={textStyle}>
                    Slippage tolerance &nbsp;
                    <Tooltip title='Your transaction will revert if price changes unfavorable by more than this percentage'>
                      <QuestionCircleOutlined />
                    </Tooltip>
                  </Text>
                  {/* TODO: there is no validation for the value yet */}
                  <Input addonAfter={<PercentageOutlined />} placeholder='0.0' value={slippageTolerance} onChange={({ target: { value } }) => setSlippageTolerance(value)} />
                </Col>
                <Col span={8} offset={2}>
                  <Text style={textStyle}>
                    Transaction deadline &nbsp;
                    <Tooltip title='Your transaction will revert if it is pending for more than this long'>
                      <QuestionCircleOutlined />
                    </Tooltip>
                  </Text>
                  {/* TODO: there is no validation for the value yet */}
                  <Input addonAfter='minutes' placeholder='0' value={transactionDeadline} onChange={({ target: { value } }) => setTransactionDeadline(value)} />
                </Col>
              </>
              )
            : <></>
        }
      </Row>
      <TallRow align='middle'>
        <Col span={12}>
          <Text style={textStyle} type='secondary'>Swap From</Text>
          <Select
            showSearch
            labelInValue
            style={{ width: 280 }}
            value={selectedTokenSwapFrom}
            onSearch={handleSearchCurrentTrackedTokens}
          >
            {swapOptions(currentTrackedTokens, onSelectTokenSwapFrom)}
          </Select>
        </Col>
        <Col span={12}>
          <Text style={textStyle} type='secondary'>Amount (Balance: {selectedTokenBalance})</Text>
          <InputBox style={amountInputStyle} placeholder='0.00' value={swapAmountFormatted} onChange={({ target: { value } }) => onSwapAmountChange(value)} />
          <Button style={maxButtonStyle} shape='round' onClick={setMaxSwapAmount}>Max</Button>
        </Col>
      </TallRow>
      <TallRow align='middle'>
        <Col span={12}>
          <Text style={textStyle} type='secondary'>Swap To</Text>
          <Select
            showSearch
            labelInValue
            style={{ width: 280 }}
            value={selectedTokenSwapTo}
            onSearch={handleSearchSupportedTokens}
          >
            {swapOptions(supportedTokens, onSelectTokenSwapTo)}
          </Select>
        </Col>
        <Col span={12}>
          <Text style={textStyle} type='secondary'>Target Amount</Text>
          <InputBox style={amountInputStyle} placeholder='0.00' value={targetSwapAmountFormatted} onChange={({ target: { value } }) => onTargetSwapAmountChange(value)} />
        </Col>
      </TallRow>
      <TallRow align='middle'>
        <Col span={24}>
          <ExchangeRateButton exchangeRate={exchangeRate} selectedTokenSwapFrom={selectedTokenSwapFrom} selectedTokenSwapTo={selectedTokenSwapTo} />
        </Col>
      </TallRow>
      <TallRow align='middle'>
        <Col span={6}>
          <Button
            shape='round'
            disabled={!swapAllowed}
            type='primary'
            onClick={confirmSwap}
          >
            Confirm
          </Button>
        </Col>
      </TallRow>
    </>
  )
}

export default Swap
