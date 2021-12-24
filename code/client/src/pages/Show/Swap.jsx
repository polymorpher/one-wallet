import { TallRow } from '../../components/Grid'
import { Col, Typography, Select, Image, Button, Row, Tooltip, Input, Space } from 'antd'
import message from '../../message'
import React, { useCallback, useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import ONEConstants from '../../../../lib/constants'
import util, { useWindowDimensions } from '../../util'
import { DefaultTrackedERC20, HarmonyONE, withKeys } from '../../components/TokenAssets'
import api from '../../api'
import { Hint, InputBox, Warning } from '../../components/Text'
import BN from 'bn.js'
import {
  PercentageOutlined,
  QuestionCircleOutlined,
  SwapOutlined
} from '@ant-design/icons'
import { OtpStack, useOtpState } from '../../components/OtpStack'
import { FallbackImage } from '../../constants/ui'
import ShowUtils from './show-util'
import { SmartFlows } from '../../../../lib/api/flow'
import ONE from '../../../../lib/onewallet'
import { useRandomWorker } from './randomWorker'
import ONEUtil from '../../../../lib/util'
import { handleTrackNewToken } from '../../components/ERC20Grid'
import { Link } from 'react-router-dom'
import { Chaining } from '../../api/flow'
import walletActions from '../../state/modules/wallet/actions'
import { balanceActions } from '../../state/modules/balance'
import { CommitRevealProgress } from '../../components/CommitRevealProgress'
import uniqBy from 'lodash/fp/uniqBy'
import styled from 'styled-components'
import ONENames from '../../../../lib/names'
const { Text, Title } = Typography

const tokenIconUrl = (token) => {
  if (token.icon) {
    return token.icon
  }
  const symbol = token.iconSymbol || token.symbol
  return `https://res.cloudinary.com/sushi-cdn/image/fetch/w_64/https://raw.githubusercontent.com/sushiswap/icons/master/token/${symbol.toLowerCase()}.jpg`
}

const textStyle = {
  paddingRight: '8px',
  display: 'block'
}

const OptionButton = styled(Button)`
  text-align: left;
  height: 48px;
  &:disabled{
    opacity: 0.3;
  }
`

const selectOptionStyle = {
  padding: 0
}

const maxButtonStyle = {
  marginLeft: '24px',
  bottom: '1px'
}

const tokenSelectorStyle = {
  minWidth: '160px', border: 'none', borderBottom: '1px solid lightgrey', width: '100%', fontSize: 16
}

const amountInputStyle = {
  margin: 0,
  flex: 1,
  borderBottom: '1px solid lightgrey',
  width: '100%'
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
      src={tokenIconUrl(token)}
    />
    {selected && <Text> {token.symbol.toUpperCase()} </Text>}
    {!selected && <Text style={{ fontSize: 10 }}> {token.symbol.toUpperCase()}<br />{token.name}</Text>}
  </Row>
)

/**
 * Renders exchange rate within a button that can flip the exchange rate.
 */
const ExchangeRate = ({ exchangeRate, selectedTokenSwapFrom, selectedTokenSwapTo }) => {
  const [flippedExchangeRate, setFlippedExchangeRate] = useState(false)

  const onFlipExchangeRate = () => {
    setFlippedExchangeRate(!flippedExchangeRate)
  }
  if (!exchangeRate) {
    return <></>
  }

  return exchangeRate && util.formatNumber(exchangeRate, 10) !== 'NaN' && (
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
    const computedBalance = util.computeBalance(tokenBalances[selectedToken.key], undefined, selectedToken.decimal)
    return computedBalance
  } catch (ex) {
    console.error(ex)
    return undefined
  }
}

const isTrivialSwap = (tokenFrom, tokenTo) => {
  return util.isONE(tokenFrom) && util.isWONE(tokenTo)
}

/**
 * Renders swap coins from ONE wallet or tracked token to another token tab.
 */
const Swap = ({ address }) => {
  const { isMobile } = useWindowDimensions()
  const wallets = useSelector(state => state.wallet)
  const network = useSelector(state => state.global.network)
  const wallet = wallets[address] || {}
  const dispatch = useDispatch()
  const [stage, setStage] = useState(-1)
  const doubleOtp = wallet.doubleOtp
  const { state: otpState } = useOtpState()
  const { otpInput, otp2Input, resetOtp } = otpState

  const harmonyToken = { ...HarmonyONE }
  const harmonySelectOption = {
    ...harmonyToken,
    value: HarmonyONE.symbol,
    label: <TokenLabel token={harmonyToken} selected />
  }

  const balances = useSelector(state => state.balance || {})
  const { balance = 0, tokenBalances = {} } = balances[address] || {}

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
  const [currentTrackedTokens, setCurrentTrackedTokens] = useState([])
  const [tokenAllowance, setTokenAllowance] = useState(new BN(0))
  const [tokenReserve, setTokenReserve] = useState({ from: new BN(0), to: new BN(0) })
  const [updatingReserve, setUpdatingReserve] = useState(false)

  const [fromAmountError, setFromAmountError] = useState('')
  const [toAmountError, setToAmountError] = useState('')
  const [unknownError, setUnknownError] = useState('')

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
    const trackedTokens = [harmonyToken, ...withKeys(DefaultTrackedERC20(network)), ...(erc20Tracked || [])]
    trackedTokens.forEach(tt => {
      // align formats
      tt.address = tt.address || tt.contractAddress
      tt.decimal = tt.decimal || tt.decimals
      if (tokens[tt.address]) {
        const cached = tokens[tt.address]
        tt.priority = cached.priority
        tt.iconSymbol = cached.iconSymbol
      }
      const { tokenType, tokenId, contractAddress, key } = tt
      if (contractAddress && key) {
        dispatch(balanceActions.fetchTokenBalance({ address, tokenType, tokenId, contractAddress, key }))
      }
    })
    const filteredTrackedTokens = uniqBy(e => e.address, trackedTokens)

    const updateFromTokens = async () => {
      const trackedTokensUpdated = await api.tokens.batchGetMetadata(filteredTrackedTokens)
      // ONE has null contractAddress
      const filteredTokens = trackedTokensUpdated.filter(t => t.contractAddress === null || tokens[t.contractAddress])

      filteredTokens.sort((t0, t1) => (t1.priority || 0) - (t0.priority || 0))
      setFromTokens(filteredTokens)
      setCurrentTrackedTokens(trackedTokensUpdated)
    }
    updateFromTokens()
  }, [tokens])

  useEffect(() => {
    const tokenBalance = getTokenBalance(tokenFrom, tokenBalances, balance)
    // console.log(tokenFrom)
    // console.log(tokenBalance)
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
    if (util.isONE(tokenFrom)) {
      toTokens.push(tokens[ONEConstants.Sushi.WONE])
    } else {
      // any token except ONE itself can be exchanged to ONE
      toTokens.push(HarmonyONE)
      // disable token <-> token exchanges for now
      for (let i = 0; i < toTokens.length - 1; i++) {
        toTokens[i].disabled = true
      }
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

    const getTokenAllowance = async () => {
      if (tokenFrom.address) {
        const allowance = await api.sushi.getAllowance({ address, contractAddress: tokenFrom.address })
        // console.log({ allowance: allowance.toString(), contractAddress: tokenFrom.address })
        setTokenAllowance(allowance)
      } else {
        setTokenAllowance(new BN(0))
      }
    }

    getTokenAllowance()
  }, [tokenFrom])

  // Checks token reserves for selected tokenFrom and tokenTo.
  useEffect(() => {
    const getTokenReserve = async () => {
      setUpdatingReserve(true)
      if (!tokenTo.value) {
        setTokenReserve({ from: new BN(0), to: new BN(0) })
        return
      }

      try {
        const req = { t0: tokenFrom.address || ONEConstants.Sushi.WONE, t1: tokenTo.address || ONEConstants.Sushi.WONE }
        if (req.t0 === req.t1) {
          setTokenReserve({ from: new BN(0), to: new BN(0) })
          return
        }
        const pairAddress = await api.sushi.getPair(req)
        if (!pairAddress || pairAddress === ONEConstants.EmptyAddress) {
          setTokenReserve({ from: new BN(0), to: new BN(0) })
          return
        }
        const { reserve0, reserve1 } = await api.sushi.getReserves({ pairAddress })
        setTokenReserve({ from: new BN(reserve0), to: new BN(reserve1) })
      } catch (e) {
        console.error(e)
        setTokenReserve({ from: new BN(0), to: new BN(0) })
      }
    }
    getTokenReserve().then(() => setUpdatingReserve(false))
  }, [tokenFrom, tokenTo])

  const buildSwapOptions = (tokens, setSelectedToken) => tokens.map((token, index) => {
    const inner = (
      <OptionButton
        type='text'
        block
        onClick={() => setSelectedToken(token)}
        disabled={token.disabled}
      >
        <TokenLabel token={token} />
      </OptionButton>
    )
    const outer = token.disabled ? <Tooltip title='This option is temporarily disabled. It will be available in the future version of 1wallet'>{inner}</Tooltip> : inner
    return <Select.Option key={index} value={token.symbol || 'one'} style={selectOptionStyle}>{outer}</Select.Option>
  })

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
    if (!util.validBalance(value, true) || parseFloat(value) === 0 || value === '') {
      if (isFrom) {
        setToAmountFormatted(undefined)
        setToAmount(undefined)
      } else {
        setFromAmountFormatted(undefined)
        setFromAmount(undefined)
      }
      return
    }
    if (isTrivialSwap(tokenFrom, tokenTo) || isTrivialSwap(tokenTo, tokenFrom) || tokenFrom.value === tokenTo.value) {
      setExchangeRate(1)
      toSetter(value)
      preciseValue !== undefined && preciseToSetter(preciseValue)
      return
    }

    if (!preciseValue) {
      const { balance: preciseAmount } = util.toBalance(value, undefined, isFrom ? tokenFrom.decimal : tokenTo.decimal)
      // console.log('preciseFromSetter', value, preciseAmount)
      preciseFromSetter(preciseAmount)
    }
    if (!tokenTo.value) {
      setExchangeRate(undefined)
      toSetter(undefined)
      preciseToSetter(undefined)
      return
    }
    const useFrom = (util.isONE(tokenFrom) || util.isWONE(tokenFrom))
    const tokenAddress = useFrom ? tokenTo.address : tokenFrom.address
    const outDecimal = isFrom ? tokenTo.decimal : tokenFrom.decimal
    const valueDecimal = isFrom ? tokenFrom.decimal : tokenTo.decimal
    const { balance: amountIn, formatted: amountInFormatted } = util.toBalance(value, undefined, valueDecimal)

    // let setAmount
    // if(isFrom) {
    //   setAmount = await api.sushi.getAmountOut({ amountIn, tokenAddress, inverse: useFrom !== isFrom })
    // }else{
    //   setAmount = await api.sushi.getAmountIn({ amountOut: amountIn, tokenAddress, inverse: useFrom !== isFrom })
    // }
    // console.log(tokenAddress, amountIn, useFrom !== isFrom)
    let amountOut
    try {
      amountOut = await api.sushi.getAmountOut({ amountIn: amountIn, tokenAddress, inverse: useFrom !== isFrom })
    } catch (ex) {
      console.error(ex)
      setUnknownError(ex.toString())
      amountOut = new BN(0)
    }

    const { formatted: amountOutFormatted } = util.computeBalance(amountOut, undefined, outDecimal)
    toSetter(amountOutFormatted)
    preciseToSetter(amountOut)
    // console.log({ useFrom, amountOutFormatted, amountInFormatted, valueDecimal, outDecimal, amountOut: amountOut.toString(), amountIn: amountIn.toString() })
    let exchangeRate = parseFloat(amountOutFormatted) / parseFloat(amountInFormatted)
    if (!isFrom) {
      exchangeRate = 1 / exchangeRate
    }
    setExchangeRate(exchangeRate)
  }, [setExchangeRate, tokenTo, tokenFrom, setToAmountFormatted, setFromAmountFormatted])

  const setMaxSwapAmount = useCallback(() => {
    const maxSpending = util.getMaxSpending(wallet)
    let { balance: tokenBalance, formatted } = getTokenBalance(tokenFrom, tokenBalances, balance)
    if (util.isONE(tokenFrom) && new BN(maxSpending).lt(new BN(tokenBalance))) {
      tokenBalance = maxSpending
      formatted = ONEUtil.toOne(maxSpending)
    }
    setFromAmountFormatted(formatted || '0')
    setFromAmount(tokenBalance)
    onAmountChange(true)({ target: { value: formatted, preciseValue: tokenBalance } })
  }, [tokenFrom, balance, tokenBalances, onAmountChange, setFromAmountFormatted])

  useEffect(() => {
    if (!fromAmountFormatted) {
      return
    }
    const parsed = parseFloat(fromAmountFormatted)
    if (isNaN(parsed) || parsed < 0) {
      setFromAmountError('Invalid Amount')
    } else {
      setFromAmountError('')
    }
  }, [fromAmountFormatted])

  useEffect(() => {
    if (!toAmountFormatted) {
      return
    }
    const parsed = parseFloat(toAmountFormatted)
    if (isNaN(parsed) || parsed < 0) {
      setToAmountError('Invalid Amount')
    } else {
      setToAmountError('')
    }
  }, [toAmountFormatted])

  useEffect(() => {
    if (tokenTo.value && !toAmountFormatted) {
      setToAmountFormatted('0')
    }
  }, [tokenTo])

  useEffect(() => {
    if (tokenFrom.value && !fromAmountFormatted) {
      setFromAmountFormatted('0')
    }
  }, [tokenFrom])

  const onSelectTokenSwapFrom = (token) => {
    setTokenFrom({ ...token, value: token.symbol, label: <TokenLabel token={token} selected /> })
    // onAmountChange(false)({ target: { value: targetSwapAmountFormatted } })
  }

  const onSelectTokenSwapTo = (token) => {
    setTokenTo({ ...token, value: token.symbol, label: <TokenLabel token={token} selected /> })
    // onAmountChange(true)({ target: { value: swapAmountFormatted } })
  }
  const { resetWorker, recoverRandomness } = useRandomWorker()
  const { prepareValidation, onRevealSuccess, ...handlers } = ShowUtils.buildHelpers({ setStage, resetOtp, network, resetWorker })

  const commonCommitReveal = ({ otp, otp2, hexData, args, trackToken, updateFromBalance, extraHandlers }) => {
    SmartFlows.commitReveal({
      wallet,
      otp,
      otp2,
      recoverRandomness,
      commitHashGenerator: ONE.computeGeneralOperationHash,
      commitHashArgs: { ...args, data: ONEUtil.hexStringToBytes(hexData) },
      prepareProof: () => setStage(0),
      beforeCommit: () => setStage(1),
      afterCommit: () => setStage(2),
      revealAPI: api.relayer.reveal,
      revealArgs: { ...args, data: hexData },
      onRevealSuccess: async (txId) => {
        onRevealSuccess(txId)
        if (trackToken) {
          const tt = await handleTrackNewToken({
            newContractAddress: tokenTo.address,
            currentTrackedTokens,
            dispatch,
            address,
            hideWarning: true
          })
          if (tt) {
            dispatch(walletActions.trackTokens({ address, tokens: [tt] }))
            setCurrentTrackedTokens(tts => [...tts, tt])
            message.success(`New token tracked: ${tt.name} (${tt.symbol}) (${tt.contractAddress}`)
          }
          Chaining.refreshBalance(dispatch, [address])
          Chaining.refreshTokenBalance({ dispatch, address, token: tt || currentTrackedTokens.find(t => t.contractAddress === tokenTo.address) })
        }
        if (updateFromBalance) {
          Chaining.refreshBalance(dispatch, [address])
          Chaining.refreshTokenBalance({ dispatch, address, token: tokenFrom })
        }
      },
      ...handlers,
      ...extraHandlers
    })
  }
  const handleSwapONEToToken = ({ slippage, deadline, otp, otp2 }) => {
    const now = Math.floor(Date.now() / 1000)
    const amountOut = new BN(toAmount).muln(10000 - slippage).divn(10000).toString()

    const hexData = ONEUtil.encodeCalldata(
      'swapETHForExactTokens(uint256,address[],address,uint256)',
      [amountOut, [ONEConstants.Sushi.WONE, tokenTo.address], address, (now + deadline)])
    const args = { amount: fromAmount.toString(), operationType: ONEConstants.OperationType.CALL, tokenType: ONEConstants.TokenType.NONE, contractAddress: ONEConstants.Sushi.ROUTER, tokenId: 0, dest: ONEConstants.EmptyAddress }
    commonCommitReveal({ otp, otp2, hexData, args, trackToken: true })
  }
  const handleSwapTokenToONE = ({ slippage, deadline, otp, otp2 }) => {
    const now = Math.floor(Date.now() / 1000)
    const amountOut = new BN(toAmount).muln(10000 - slippage).divn(10000).toString()

    const hexData = ONEUtil.encodeCalldata(
      'swapExactTokensForETH(uint256,uint256,address[],address,uint256)',
      [fromAmount.toString(), amountOut.toString(), [tokenFrom.address, ONEConstants.Sushi.WONE], address, (now + deadline)])
    const args = { amount: 0, operationType: ONEConstants.OperationType.CALL, tokenType: ONEConstants.TokenType.NONE, contractAddress: ONEConstants.Sushi.ROUTER, tokenId: 0, dest: ONEConstants.EmptyAddress }
    commonCommitReveal({ otp, otp2, hexData, args, updateFromBalance: true })
  }
  const handleSwapONEToWONE = ({ otp, otp2 }) => {
    const hexData = ONEUtil.encodeCalldata('deposit()', [])
    const args = { amount: fromAmount.toString(), operationType: ONEConstants.OperationType.CALL, tokenType: ONEConstants.TokenType.NONE, contractAddress: ONEConstants.Sushi.WONE, tokenId: 0, dest: ONEConstants.EmptyAddress }
    commonCommitReveal({ otp, otp2, hexData, args, trackToken: true })
  }
  const handleSwapWONEToONE = ({ otp, otp2 }) => {
    const hexData = ONEUtil.encodeCalldata('withdraw(uint256)', [fromAmount.toString()])
    const args = { amount: 0, operationType: ONEConstants.OperationType.CALL, tokenType: ONEConstants.TokenType.NONE, contractAddress: ONEConstants.Sushi.WONE, tokenId: 0, dest: ONEConstants.EmptyAddress }
    commonCommitReveal({ otp, otp2, hexData, args, updateFromBalance: true })
  }
  const confirmSwap = () => {
    // const { balance: fromBalance } = util.toBalance(fromAmountFormatted, undefined, selectedTokenSwapFrom.decimal)
    const { balance: tokenBalance, formatted: tokenBalanceFormatted } = getTokenBalance(tokenFrom, tokenBalances, balance)
    // console.log(new BN(tokenBalance).toString())
    // console.log(new BN(fromAmount).toString())
    if (!(new BN(tokenBalance).gte(new BN(fromAmount)))) {
      // console.log(new BN(tokenBalance).toString())
      // console.log(new BN(fromAmount).toString())
      message.error(`Insufficient balance (got ${tokenBalanceFormatted}, need ${fromAmountFormatted})`)
      return
    }

    const slippage = Math.floor(parseFloat(slippageTolerance.trim()) * 100)
    if (!(slippage > 0 && slippage < 10000)) {
      message.error('Slippage tolerance must be a number between 0-100 with at most 2 decimal precision')
      return
    }
    const deadline = parseInt(transactionDeadline)
    if (!(deadline < 3600 && deadline > 0)) {
      message.error('Deadline must be between 0-3600 seconds')
      return
    }
    // console.log(otpInput)
    const { otp, otp2, invalidOtp2, invalidOtp } = prepareValidation({ state: { otpInput, otp2Input, doubleOtp }, checkAmount: false, checkDest: false }) || {}
    if (invalidOtp || invalidOtp2) return
    // console.log(`swapping [${fromAmountFormatted}] from [${tokenFrom.name}] to [${tokenTo.name}]`)
    if (util.isONE(tokenFrom) && util.isWONE(tokenTo)) {
      return handleSwapONEToWONE({ otp, otp2 })
    }
    if (util.isONE(tokenTo) && util.isWONE(tokenFrom)) {
      return handleSwapWONEToONE({ otp, otp2 })
    }
    if (util.isONE(tokenFrom)) {
      return handleSwapONEToToken({ slippage, deadline, otp, otp2 })
    }
    handleSwapTokenToONE({ slippage, deadline, otp, otp2 })
  }

  const approveToken = () => {
    const { otp, otp2, invalidOtp2, invalidOtp } = prepareValidation({ state: { otpInput, otp2Input, doubleOtp }, checkAmount: false, checkDest: false }) || {}
    if (invalidOtp || invalidOtp2) return
    const hexData = ONEUtil.encodeCalldata(
      'approve(address,uint256)',
      [ONEConstants.Sushi.ROUTER, new BN(new Uint8Array(32).fill(0xff)).toString()])
    const args = { amount: 0, operationType: ONEConstants.OperationType.CALL, tokenType: ONEConstants.TokenType.NONE, contractAddress: tokenFrom.address, tokenId: 0, dest: ONEConstants.EmptyAddress }
    commonCommitReveal({
      otp,
      otp2,
      hexData,
      args,
      extraHandlers: {
        onRevealSuccess: async (txId) => {
          onRevealSuccess(txId)
          message.info('Verifying token approval status... It might take 5-10 seconds')
          Chaining.refreshAllowance({ address, contractAddress: tokenFrom.address, onAllowanceReceived: setTokenAllowance })
        },
      }
    })
  }

  // const swapAllowed =
  //   tokenFrom.value !== '' &&
  //   tokenTo.value !== '' &&
  //   fromAmountFormatted !== '' && !isNaN(fromAmountFormatted) &&
  //   toAmountFormatted !== '' && !isNaN(toAmountFormatted)

  const tokenApproved = util.isONE(tokenFrom) || isTrivialSwap(tokenTo, tokenFrom) || tokenAllowance.gt(fromAmount ? new BN(fromAmount) : new BN(0))

  const insufficientLiquidity = !updatingReserve && tokenTo.value && toAmount && !isTrivialSwap(tokenFrom, tokenTo) && !isTrivialSwap(tokenTo, tokenFrom) && tokenReserve.to.lt(new BN(toAmount || 0))

  if (!(wallet.majorVersion >= 10)) {
    return (
      <TallRow align='middle'>
        <Warning>Your wallet is too old. Please upgrade to at least version 10.1 to use swap</Warning>
      </TallRow>
    )
  }

  return (
    <>
      <TallRow>
        <Row align='middle' style={{ width: '100%' }} gutter={[32, 32]}>
          <Col span={isMobile ? 24 : 8}>
            <Space direction='vertical' style={{ width: '100%' }}>
              <Text style={textStyle} type='secondary'>From</Text>
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
            </Space>
          </Col>
          <Col span={isMobile ? 24 : 16}>
            <Space direction='vertical' style={{ width: '100%' }}>
              <Text style={textStyle} type={fromAmountError ? 'danger' : 'secondary'}>Amount (Balance: {tokenBalanceFormatted}) {fromAmountError}</Text>
              <Row>
                <InputBox $decimal size='default' style={amountInputStyle} placeholder='0.00' value={fromAmountFormatted} onChange={onAmountChange(true)} />
                <Button style={maxButtonStyle} shape='round' onClick={setMaxSwapAmount}>Max</Button>
              </Row>
            </Space>
          </Col>
        </Row>
      </TallRow>
      <TallRow>
        <Row align='middle' style={{ width: '100%' }} gutter={[32, 32]}>
          <Col span={isMobile ? 24 : 8}>
            <Space direction='vertical' style={{ width: '100%' }}>
              <Text style={textStyle} type='secondary'>To</Text>
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
            </Space>
          </Col>
          <Col span={isMobile ? 24 : 16}>
            <Space direction='vertical' style={{ width: '100%' }}>
              <Text style={textStyle} type={toAmountError ? 'danger' : 'secondary'}>Expected Amount {toAmountError}</Text>
              <InputBox $decimal size='default' style={{ ...amountInputStyle, width: '100%' }} placeholder='0.00' value={toAmountFormatted} onChange={onAmountChange(false)} />
            </Space>
          </Col>
        </Row>
      </TallRow>
      <TallRow align='middle'>
        <Col span={24}>
          <ExchangeRate exchangeRate={exchangeRate} selectedTokenSwapFrom={tokenFrom} selectedTokenSwapTo={tokenTo} />
        </Col>
      </TallRow>
      {insufficientLiquidity &&
        <TallRow>
          <Col span={24}>
            <Warning>
              Insufficient liquidity in SushiSwap. Please reduce expected amount or try a different token pair.
            </Warning>
          </Col>
        </TallRow>}
      {unknownError &&
        <TallRow>
          <Col span={24}>
            <Warning>
              An unknown error occurred. Network might be offline. The token pair may have insufficient liquidity. Please submit a bug report if you think you caught a bug in 1wallet. Error: {unknownError}
            </Warning>
          </Col>
        </TallRow>}

      <TallRow>
        <OtpStack walletName={ONENames.nameWithTime(wallet.name, wallet.effectiveTime)} doubleOtp={doubleOtp} otpState={otpState} onComplete={tokenApproved ? confirmSwap : approveToken} action={tokenApproved ? 'approve' : 'confirm'} />
      </TallRow>
      <TallRow justify='start' align='baseline'>
        <Space size='large' align='top'>
          <Button type='link' size='large' style={{ padding: 0 }} onClick={() => setEditingSetting(!editingSetting)}>{editingSetting ? 'Close' : 'Advanced Settings'}</Button>
        </Space>
      </TallRow>
      {
        !tokenApproved &&
          <TallRow>
            <Col span={24}>
              <Title level={4}>
                Authorize SushiSwap to transfer your {tokenFrom.symbol}?
              </Title>
              <Hint>
                You only need to do this once for each token. Only with your approval, SushiSwap can swap your {tokenFrom.symbol} for ONE or another token.
                <br /><br />
                SushiSwap operates as a smart contract. Based on its <Link to='https://github.com/sushiswap/sushiswap' target='_blank' rel='noreferrer'>source code</Link>, it can only move your token when you initiate a swap.
              </Hint>
            </Col>
          </TallRow>
      }
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
      <CommitRevealProgress stage={stage} style={{ marginTop: 32 }} />
    </>
  )
}

export default Swap
