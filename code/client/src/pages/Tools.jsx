import React, { useEffect, useState } from 'react'
import AnimatedSection from '../components/AnimatedSection'
import Typography from 'antd/es/typography'
import Divider from 'antd/es/divider'
import Button from 'antd/es/button'
import Space from 'antd/es/space'
import Image from 'antd/es/image'
import Row from 'antd/es/row'
import message from '../message'
import { useSelector } from 'react-redux'
import { Hint, InputBox, LabeledRow } from '../components/Text'
import WalletAddress from '../components/WalletAddress'
import util, { useWindowDimensions } from '../util'
import AddressInput from '../components/AddressInput'
import BN from 'bn.js'
import { api } from '../../../lib/api'
import { KnownERC20 } from '../components/TokenAssets'
import ONEUtil from '../../../lib/util'
import ONEConstants from '../../../lib/constants'
import { TallRow } from '../components/Grid'
import { matchPath, useHistory, useLocation, useRouteMatch } from 'react-router'
import Paths from '../constants/paths'
import MetaMaskAdd from '../../assets/metamask-add.png'
import MetaMaskSwitch from '../../assets/metamask-switch.png'
const { Text, Title } = Typography

const Sections = {
  SushiEncoder: 'safe-sushi',
  MetamaskAdd: 'metamask-add',
  Home: '',
}

const ToolMap = {
  'safe-sushi': true,
  '': true,
  'metamask-add': true,
}

const SectionConfig = {
  style: { minHeight: 320, maxWidth: 720 }
}

const SushiSwapEncoder = ({ onClose }) => {
  const [inputAmount, setInputAmount] = useState('')
  const [input, setInput] = useState(new BN())
  const [output, setOutput] = useState(new BN())
  const [outputMax, setOutputMax] = useState(new BN())
  const { formatted: outputFormatted } = util.computeBalance(output.toString(), null, KnownERC20.USDT.decimals)
  const { formatted: outputMaxFormatted } = util.computeBalance(outputMax.toString(), null, KnownERC20.USDT.decimals)
  const [transferTo, setTransferTo] = useState({ value: '', label: '' })
  const [hex, setHex] = useState('')
  const { isMobile } = useWindowDimensions()
  const [isInputAmountFocused, setIsInputAmountFocused] = useState()
  const [deadline, setDeadline] = useState()
  const [slippage] = useState(50)

  useEffect(() => {
    async function f () {
      let input
      try {
        const { balance } = util.toBalance(inputAmount)
        input = new BN(balance)
        setInput(input)
      } catch (ex) {
        if (!isInputAmountFocused && inputAmount) {
          message.error('Cannot parse input amount')
        }
        return
      }
      try {
        let outputMax = await api.sushi.getAmountOut({ amountIn: input.toString(), tokenAddress: KnownERC20.USDT.contractAddress })
        outputMax = new BN(outputMax)
        const output = outputMax.muln(10000 - slippage).divn(10000)
        console.log(outputMax, output)
        setOutput(output)
        setOutputMax(outputMax)
      } catch (ex) {
        message.error('Cannot get expected exchange amount')
        console.error(ex)
      }
    }
    f()
  }, [inputAmount, isInputAmountFocused])

  useEffect(() => {
    if (!(transferTo?.value?.length === 42)) {
      return
    }
    const dest = util.safeNormalizedAddress(transferTo.value)
    if (util.isEmptyAddress(dest) || input.isZero() || !output.isZero()) {
      setHex('Invalid input')
    }
    const now = Math.floor(Date.now() / 1000 / 300) * 300 // 5min resolution

    try {
      const hex = ONEUtil.encodeCalldata('swapExactETHForTokens(uint256,address[],address,uint256)', [
        output.toString(), [ONEConstants.Sushi.WONE, KnownERC20.USDT.contractAddress], dest, now + 3600
      ])
      console.log(hex)
      setHex(hex)
      setDeadline((now + 3600) * 1000)
    } catch (ex) {
      console.error(ex)
      message.error('Unable to compute the encoding. Error: ' + ex.toString())
    }
  }, [input, output, transferTo])

  return (
    <>
      <Text>This tool helps you produce the hex data required to swap ONE for 1USDT using a Harmony Safe transaction</Text>
      <LabeledRow isMobile={isMobile} label='Paying' align='middle'>
        <Space>
          <InputBox
            $decimal
            margin='auto'
            width='100%'
            value={inputAmount}
            onBlur={() => setIsInputAmountFocused(false)}
            onFocus={() => setIsInputAmountFocused(true)}
            onChange={({ target: { value } }) => setInputAmount(value)}
          />
          <Hint>ONE</Hint>
        </Space>
      </LabeledRow>
      <LabeledRow isMobile={isMobile} label='Getting' align='middle'>
        {!output.isZero() &&
          <Space>
            <Text>{outputFormatted} to {outputMaxFormatted}</Text>
            <Hint>1USDT</Hint>
          </Space>}
      </LabeledRow>
      <LabeledRow isMobile={isMobile} label='Safe' align='middle'>
        <AddressInput
          useHex
          addressValue={transferTo}
          setAddressCallback={setTransferTo}
        />
      </LabeledRow>
      <LabeledRow isMobile={isMobile} label='Hex' align='middle'>
        {hex && <Text copyable>{hex}</Text>}
      </LabeledRow>
      <LabeledRow isMobile={isMobile} label='Expiry' align='middle'>
        {hex && deadline && <Text>{new Date(deadline).toLocaleString()}</Text>}
      </LabeledRow>
      <Space wrap>
        <Text>Hint: SushiSwap Contract Address</Text>
        <WalletAddress address={ONEConstants.Sushi.ROUTER} useHex alwaysShowOptions />
      </Space>
      <TallRow>
        <Button danger type='text' onClick={onClose}>Go back</Button>
      </TallRow>
    </>
  )
}

const addHarmonyNetwork = async () => {
  if (!window.ethereum || !window.ethereum.isMetaMask) {
    message.error('MetaMask not found')
    return
  }
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x63564C40' }],
    })
    message.success('Switched to Harmony Network on MetaMask')
  } catch (ex) {
    console.error(ex)
    if (ex.code !== 4902) {
      message.error('Failed to switch to Harmony network:' + ex.message)
      return
    }
    try {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: '0x63564C40', // A 0x-prefixed hexadecimal string
          chainName: 'Harmony Mainnet Shard 0',
          nativeCurrency: {
            name: 'ONE',
            symbol: 'ONE',
            decimals: 18
          },
          rpcUrls: ['https://api.harmony.one'],
          blockExplorerUrls: ['https://www.harmony.one/']
        }]
      })
      message.success('Added Harmony Network on MetaMask')
    } catch (ex2) {
      // message.error('Failed to add Harmony network:' + ex.toString())
      message.error('Failed to add Harmony network:' + ex.message)
    }
  }
}

const Tools = () => {
  const dev = useSelector(state => state.global.dev)
  const wallets = useSelector(state => state.wallet)
  const [section, setSection] = useState(Sections.Home)

  const history = useHistory()
  const location = useLocation()
  const match = useRouteMatch(Paths.toolLink)
  const { tool } = match ? match.params : {}

  useEffect(() => {
    const m = matchPath(location.pathname, { path: Paths.toolLink })
    const { tool } = m ? m.params : {}

    if (ToolMap[tool] === true) {
      setSection(tool)
      return
    }
    setSection(Sections.Home)
  }, [location])

  useEffect(() => {
    if (section === Sections.MetamaskAdd) {
      addHarmonyNetwork()
    }
  }, [section])

  const openTool = (tool) => { history.push(Paths.toolOpen(tool)) }

  const dumpState = () => {
    const url = window.URL.createObjectURL(new Blob([JSON.stringify(wallets)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.style.display = 'none'
    a.href = url
    // the filename you want
    a.download = '1wallet-state-dump.json'
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
  }

  return (
    <>
      {section === Sections.Home &&
        <AnimatedSection wide>
          <Space direction='vertical' style={{ width: '100%' }}>
            <Title level={3}>MetaMask</Title>
            <Button type='primary' shape='round' onClick={() => openTool(Sections.MetamaskAdd)}>Switch to Harmony Network</Button>
            <Divider />
            <Title level={3}>Harmony Safe</Title>
            <Space wrap>
              <Button type='primary' shape='round' href='http://multisig.harmony.one' target='_blank'>Open Harmony MultiSig</Button>
              <Button type='primary' shape='round' onClick={() => openTool(Sections.SushiEncoder)}>SushiSwap Transaction Encoder</Button>
            </Space>
            {dev &&
              <>
                <Divider />
                <Title level={3}>Developer Tools</Title>
                <Button type='primary' shape='round' onClick={dumpState}>Dump Wallet States</Button>
              </>}
          </Space>
        </AnimatedSection>}
      {section === Sections.SushiEncoder &&
        <AnimatedSection title='Harmony Safe | SushiSwap Encoder' wide>
          <SushiSwapEncoder onClose={() => openTool()} />
        </AnimatedSection>}
      {section === Sections.MetamaskAdd &&
        <AnimatedSection title='Switch to Harmony Network' wide>
          <Space direction='vertical' style={{ width: '100%' }}>
            <Text>This tool helps you quickly setup MetaMask for Harmony. Follow the instructions on MetaMask extension to complete the setup</Text>
            <Divider />
            <Text>You should see something like this. Verify the information and click "Approve" to proceed.</Text>
            <Row justify='center'><Image src={MetaMaskAdd} style={{ objectFit: 'contain', maxHeight: 600 }} /></Row>
            <Divider />
            <Text>If you already had Harmony on MetaMask, it will help you switch to Harmony network instead.</Text>
            <Row justify='center'><Image src={MetaMaskSwitch} style={{ objectFit: 'contain', maxHeight: 600 }} /></Row>
            <TallRow justify='space-between'>
              <Button type='text' danger onClick={() => openTool()}>Cancel</Button>
              <Button type='primary' shape='round' onClick={addHarmonyNetwork}>Retry</Button>
            </TallRow>
          </Space>
        </AnimatedSection>}
    </>
  )
}

export default Tools
