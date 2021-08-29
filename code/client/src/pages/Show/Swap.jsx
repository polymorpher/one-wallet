import { TallRow } from '../../components/Grid'
import { Col, Typography, Select, Image, Button, message } from 'antd'
import React, { useCallback, useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { mockCryptos } from './mock-cryptos'
import ONEConstants from '../../../../lib/constants'
import util from '../../util'
import { DefaultTrackedERC20, HarmonyONE, withKeys } from '../../components/TokenAssets'
import api from '../../api'
import { InputBox } from '../../components/Text'
import { trim } from 'lodash'
const { Text } = Typography

// TODO: some token's images are not available, we may want a CDN or other service that can retrieve icons dynamically.
const cryptoIconUrl = (symbol) => `https://qokka-public.s3-us-west-1.amazonaws.com/crypto-logos/${symbol.toLowerCase()}.png`

const TokenLabel = ({ token }) => (
  <>
    <Image
      style={{ display: 'inline', paddingRight: '5px' }}
      preview={false}
      width={20}
      height={20}
      src={cryptoIconUrl(token.symbol)}
    />
    <Text>{token.name}</Text>
  </>
)

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

    const computedBalance = util.computeBalance(tokenBalances[selectedToken.address], selectedToken.decimals)

    return computedBalance
  } catch (ex) {
    console.error(ex)
    return undefined
  }
}

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
    label: <TokenLabel token={harmonyToken} />
  }
  const defaultTrackedTokens = withKeys(DefaultTrackedERC20(network))
  const [currentTrackedTokens, setCurrentTrackedTokens] = useState([harmonyToken, ...defaultTrackedTokens, ...(trackedTokens || [])])
  const balances = useSelector(state => state.wallet.balances)
  const balance = balances[address] || 0
  const [supportedTokens, setSupportedTokens] = useState([])
  const [selectedTokenSwapFrom, setSelectedTokenSwapFrom] = useState(harmonySelectOption)
  const [selectedTokenSwapTo, setSelectedTokenSwapTo] = useState({ value: '', label: '' })
  const [swapAmount, setSwapAmount] = useState()
  const [selectedTokenBalance, setSelectedTokenBalance] = useState('0')

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
  }, [currentTrackedTokens, setCurrentTrackedTokens])

  useEffect(() => {
    const tokenBalance = getSelectedTokenComputedBalance(selectedTokenSwapFrom, tokenBalances, balance)

    if (!tokenBalance) {
      return '0'
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
    setSelectedTokenSwapFrom({ ...token, value: token.symbol, label: <TokenLabel token={token} /> })
  }

  const onSelectTokenSwapTo = (token) => {
    setSelectedTokenSwapTo({ ...token, value: token.symbol, label: <TokenLabel token={token} /> })
  }

  const onSwapAmountChange = (value) => {
    const amount = trim(value)
    if (isNaN(parseInt(amount, 10))) {
      setSwapAmount(undefined)
    } else {
      setSwapAmount(amount)
    }
  }

  const confirmSwap = useCallback(() => {
    const swapAmountBalance = util.toBalance(swapAmount)
    const computedTokenBalance = getSelectedTokenComputedBalance(selectedTokenSwapFrom, tokenBalances, balance)
    const tokenBalance = util.toBalance(computedTokenBalance.formatted)
    const bnTokenBn = tokenBalance.balance
    const swapAmountBn = swapAmountBalance.balance

    if (swapAmountBalance && bnTokenBn.gte(swapAmountBn)) {
      // TODO: actual swapping functionalities.
      console.log(`swapping [${swapAmount}] [${swapAmountBalance.balance}] from [${selectedTokenSwapFrom.name}] to [${selectedTokenSwapTo.name}]`)
    } else {
      message.error('Not enough balance to swap')
    }
  }, [selectedTokenSwapFrom, selectedTokenSwapTo, tokenBalances, balance, swapAmount])

  const setMaxSwapAmount = () => {
    const tokenBalance = getSelectedTokenComputedBalance(selectedTokenSwapFrom, tokenBalances, balance)

    const amount = tokenBalance ? tokenBalance.formatted : '0'

    setSwapAmount(amount)
  }

  const swapSelected = selectedTokenSwapFrom.value !== '' && selectedTokenSwapTo.value !== '' && swapAmount > 0

  return (
    <>
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
          <InputBox style={amountInputStyle} placeholder='0.00' value={swapAmount} onChange={({ target: { value } }) => onSwapAmountChange(value)} />
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
      </TallRow>
      <TallRow align='middle'>
        <Col span={6}>
          <Button
            shape='round'
            disabled={!swapSelected}
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
