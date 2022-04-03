import Row from 'antd/es/row'
import Space from 'antd/es/space'
import Typography from 'antd/es/typography'
import message from '../../message'
import { Hint, Label, Warning } from '../../components/Text'
import AddressInput from '../../components/AddressInput'
import { CommitRevealProgress } from '../../components/CommitRevealProgress'
import AnimatedSection from '../../components/AnimatedSection'
import React, { useState } from 'react'
import { SmartFlows } from '../../../../lib/api/flow'
import ONE from '../../../../lib/onewallet'
import ONEConstants from '../../../../lib/constants'
import { api } from '../../../../lib/api'
import walletActions from '../../state/modules/wallet/actions'
import ShowUtils from './show-util'
import { OtpStack } from '../../components/OtpStack'
import util, { autoWalletNameHint } from '../../util'
import { useOps } from '../../components/Common'
const { Title } = Typography

const TransferDomain = ({ address, onClose }) => {
  const {
    wallet, wallets, forwardWallet, network, stage, setStage, dispatch,
    resetWorker, recoverRandomness, otpState,
  } = useOps({ address })

  const domain = wallet.domain || ''
  const [transferTo, setTransferTo] = useState({ value: '', label: '' })
  const { otpInput, otp2Input } = otpState
  const resetOtp = otpState.resetOtp

  const { prepareValidation, ...handlers } = ShowUtils.buildHelpers({
    setStage,
    resetOtp,
    network,
    resetWorker,
    onSuccess: async () => {
      const dest = util.safeNormalizedAddress(transferTo.value)
      const resolved = await api.blockchain.domain.resolve({ domain })
      if (resolved === dest) {
        message.success(`Domain ${domain} is transferred to ${dest}`)
        if (wallets[dest]) {
          dispatch(walletActions.bindDomain({ address: dest, domain }))
        }
        if (address !== resolved) {
          dispatch(walletActions.bindDomain({ address, domain: null }))
        }
      } else {
        message.success(`Domain ${domain} is not yet resolved to ${dest}. There might be a delay. Please check again later`)
      }
      onClose()
    }
  })

  const doTransferDomain = async () => {
    if (stage >= 0) {
      return
    }
    const subdomain = domain.slice(0, domain.length - ONEConstants.Domain.DEFAULT_TLD.length - ONEConstants.Domain.DEFAULT_PARENT_LABEL.length - 2)
    const { otp, otp2, invalidOtp2, invalidOtp, dest } = prepareValidation({
      state: { otpInput, otp2Input, doubleOtp: wallet.doubleOtp, transferTo },
      checkAmount: false
    }) || {}
    if (invalidOtp || !dest || invalidOtp2) return
    setStage(0)
    SmartFlows.commitReveal({
      wallet,
      forwardWallet,
      otp,
      otp2,
      commitHashGenerator: ONE.computeTransferDomainHash,
      commitRevealArgs: { dest, subdomain },
      revealAPI: api.relayer.revealTransferDomain,
      recoverRandomness,
      ...handlers,
    })
  }

  return (
    <AnimatedSection wide onClose={onClose} title={<Title level={2}>Transfer Domain</Title>}>
      <Space direction='vertical' size='large'>
        <Hint>You will transfer ownership of domain {wallet.domain} to this address. Note that address still needs to reclaim reverse address lookup. If it is an 1wallet, its owner will be able to do so in the user interface.</Hint>
        <Space align='baseline' size='large'>
          <Label><Hint>Address</Hint></Label>
          <AddressInput
            addressValue={transferTo}
            setAddressCallback={setTransferTo}
            currentWallet={wallet}
          />
        </Space>
        <OtpStack walletName={autoWalletNameHint(wallet)} otpState={otpState} doubleOtp={wallet.doubleOtp} onComplete={doTransferDomain} action='confirm' />
      </Space>
      {!domain &&
        <Row justify='center' style={{ margin: 12 }}>
          <Warning>This wallet is not bound to a domain</Warning>
        </Row>}

      <CommitRevealProgress stage={stage} />
    </AnimatedSection>
  )
}

export default TransferDomain
