import React, { useState } from 'react'
import Button from 'antd/es/button'
import Col from 'antd/es/col'
import Row from 'antd/es/row'
import Typography from 'antd/es/typography'
import { Hint, InputBox, Label, Warning } from '../../components/Text'
import AddressInput from '../../components/AddressInput'
import { CommitRevealProgress } from '../../components/CommitRevealProgress'
import AnimatedSection from '../../components/AnimatedSection'
import util, { autoWalletNameHint } from '../../util'
import BN from 'bn.js'
import ShowUtils from './show-util'
import { useSelector } from 'react-redux'
import { HarmonyONE } from '../../components/TokenAssets'
import { SmartFlows } from '../../../../lib/api/flow'
import ONE from '../../../../lib/onewallet'
import { api } from '../../../../lib/api'
import { Chaining } from '../../api/flow'
import intersection from 'lodash/fp/intersection'
import ONEConstants from '../../../../lib/constants'
import { OtpStack } from '../../components/OtpStack'
import { AverageRow } from '../../components/Grid'
import { useOps } from '../../components/Common'
const { Title, Link } = Typography

const Send = ({
  address,
  onClose, // optional
  onSuccess, // optional
  overrideToken, // optional
  prefillAmount, // string, number of tokens, in whole amount (not wei)
  prefillDest, // string, hex format
}) => {
  const {
    wallet, wallets, forwardWallet, network, stage, setStage, dispatch,
    resetWorker, recoverRandomness, otpState, isMobile,
  } = useOps({ address })
  const doubleOtp = wallet.doubleOtp
  const { otpInput, otp2Input, resetOtp } = otpState
  const balances = useSelector(state => state.balance || {})
  const price = useSelector(state => state.global.price)
  const { balance = 0, tokenBalances = {} } = balances[address] || {}
  const selectedToken = overrideToken || wallet?.selectedToken || HarmonyONE
  const selectedTokenBalance = selectedToken.key === 'one' ? balance : (tokenBalances[selectedToken.key] || 0)
  const selectedTokenDecimals = selectedToken.decimals

  const { formatted } = util.computeBalance(selectedTokenBalance, price, selectedTokenDecimals)

  const [transferTo, setTransferTo] = useState({ value: prefillDest || '', label: prefillDest ? util.oneAddress(prefillDest) : '' })
  const [inputAmount, setInputAmount] = useState(prefillAmount || '')

  const isNFT = util.isNFT(selectedToken)
  const { metadata } = selectedToken
  const titleSuffix = isNFT ? 'Collectible' : `${selectedToken.name} (${selectedToken.symbol})`

  const maxSpending = selectedToken.key === 'one' ? BN.min(new BN(selectedTokenBalance), util.getMaxSpending(wallet)) : new BN(selectedTokenBalance)
  const { formatted: spendingLimitFormatted } = util.computeBalance(maxSpending.toString(), price)

  const {
    balance: transferAmount,
    fiatFormatted: transferFiatAmountFormatted
  } = util.toBalance(inputAmount || 0, price, selectedTokenDecimals)
  // console.log(transferAmount.toString(), selectedTokenDecimals)

  const useMaxAmount = () => {
    if (util.isNFT(selectedToken)) {
      setInputAmount(selectedTokenBalance.toString())
      return
    }
    if (new BN(selectedTokenBalance, 10).gt(new BN(maxSpending, 10))) {
      setInputAmount(spendingLimitFormatted)
    } else {
      setInputAmount(formatted)
    }
  }

  const { prepareValidation, onRevealSuccess, ...helpers } = ShowUtils.buildHelpers({
    setStage,
    resetOtp,
    network,
    resetWorker,
  })

  const doSend = () => {
    if (stage >= 0) {
      return
    }
    const { otp, otp2, invalidOtp2, invalidOtp, dest, amount } = prepareValidation({
      state: { otpInput, otp2Input, doubleOtp: wallet.doubleOtp, selectedToken, transferTo, inputAmount, transferAmount }
    }) || {}

    if (invalidOtp || !dest || invalidOtp2) return

    if (selectedToken.key === 'one') {
      SmartFlows.commitReveal({
        wallet,
        forwardWallet,
        otp,
        otp2,
        recoverRandomness,
        commitHashGenerator: ONE.computeTransferHash,
        revealAPI: api.relayer.revealTransfer,
        commitRevealArgs: { dest, amount },
        ...helpers,
        onRevealSuccess: (tx, messages) => {
          onRevealSuccess(tx, messages)
          onSuccess && onSuccess(tx)
          Chaining.refreshBalance(dispatch, intersection(Object.keys(wallets), [dest, address]))
        }
      })
    } else {
      SmartFlows.commitReveal({
        wallet,
        forwardWallet,
        otp,
        otp2,
        recoverRandomness,
        commitHashGenerator: ONE.computeGeneralOperationHash,
        revealAPI: api.relayer.revealTokenOperation,
        commitRevealArgs: { dest, amount, operationType: ONEConstants.OperationType.TRANSFER_TOKEN, tokenType: selectedToken.tokenType, contractAddress: selectedToken.contractAddress, tokenId: selectedToken.tokenId },
        ...helpers,
        onRevealSuccess: (txId, messages) => {
          onRevealSuccess(txId, messages)
          onSuccess && onSuccess(txId)
          Chaining.refreshTokenBalance({ dispatch, address, token: selectedToken })
        }
      })
    }
  }

  return (
    <AnimatedSection wide title={<Title level={isMobile ? 5 : 2}>{isMobile ? '' : 'Send: '}{titleSuffix}</Title>} onClose={onClose}>
      <AverageRow>
        <Warning>
          DO NOT send funds to centralized exchanges<br /><br />
          Centralized exchange such as Binance and crypto.com cannot detect deposits from smart contracts at this time. We are working on <Link href='https://github.com/polymorpher/one-wallet/issues/293' target='_blank' rel='noreferrer'>a new solution</Link> to address this issue in future releases.
        </Warning>
      </AverageRow>
      <Row align='middle' style={{ marginBottom: '10px' }}>
        <Col>
          {isNFT && <Title level={4}>{metadata?.displayName}</Title>}
        </Col>
      </Row>
      <Row align='baseline' style={{ marginBottom: '10px' }}>
        <Col xs={4}>
          <Label wide={!isMobile} style={{ fontSize: isMobile ? '12px' : undefined }}>
            <Hint>To</Hint>
          </Label>
        </Col>
        <Col xs={20}>
          <AddressInput
            addressValue={transferTo}
            setAddressCallback={setTransferTo}
            currentWallet={wallet}
            disabled={!!prefillDest}
          />
        </Col>
      </Row>
      <Row align='middle' style={{ marginBottom: '10px', flexWrap: 'nowrap' }}>
        <Col xs={4}>
          <Label wide={!isMobile}>
            <Hint>{isMobile ? '' : 'Amount'}</Hint>
          </Label>
        </Col>
        <Col sm={!isNFT ? 16 : 18} flex={1}>
          <InputBox
            $decimal
            margin='auto'
            width='100%'
            value={inputAmount}
            onChange={({ target: { value } }) => setInputAmount(value)}
            disabled={!!prefillAmount}
          />
        </Col>
        {
          !isNFT && <Col sm={2} xs={4}><Hint>{selectedToken.symbol}</Hint></Col>
        }
        <Col>
          <Button type='secondary' shape='round' onClick={useMaxAmount} disabled={!!prefillAmount}>max</Button>
        </Col>
      </Row>
      {
        selectedToken.key === 'one' &&
          <Row align='middle' justify='end' style={{ marginBottom: isMobile ? 16 : 32, marginTop: isMobile ? 16 : 32, paddingRight: 80 }}>
            <Col>
              <Title
                level={4}
                style={{ marginBottom: 0, display: 'inline-block' }}
              >
                ≈ ${transferFiatAmountFormatted}
              </Title>
              &nbsp;
              <Hint>USD</Hint>
            </Col>
          </Row>
        }
      <Row align='middle'>
        <Col span={24}>
          <OtpStack
            walletName={autoWalletNameHint(wallet)}
            doubleOtp={doubleOtp}
            otpState={otpState}
            onComplete={doSend}
            action='send now'
          />
        </Col>
      </Row>
      <CommitRevealProgress stage={stage} />
    </AnimatedSection>
  )
}

export default Send
