import React from 'react'
import Col from 'antd/es/col'
import Row from 'antd/es/row'
import { Text } from '../../../components/Text'
import { CommitRevealProgress } from '../../../components/CommitRevealProgress'
import { autoWalletNameHint } from '../../../util'
import ShowUtils from '../show-util'
import { SmartFlows } from '../../../../../lib/api/flow'
import ONE from '../../../../../lib/onewallet'
import ONEConstants from '../../../../../lib/constants'
import { api } from '../../../../../lib/api'
import Paths from '../../../constants/paths'
import { OtpStack } from '../../../components/OtpStack'
import { useOps } from '../../../components/Common'
import { useHistory } from 'react-router'
import ONEUtil from '../../../../../lib/util'
import { StakeCommon, RewardPanel } from './StakeCommon'

const CollectStateReward = ({
  address,
  onClose, // optional
  onSuccess, // optional
}) => {
  const history = useHistory()
  const {
    wallet, network, stage, setStage,
    resetWorker, recoverRandomness, otpState, isMobile,
  } = useOps({ address })
  const doubleOtp = wallet.doubleOtp
  const { otpInput, otp2Input, resetOtp } = otpState

  onClose = onClose || (() => history.push(Paths.showAddress(address, 'stake')))

  const { prepareValidation, ...handlers } = ShowUtils.buildHelpers({
    setStage,
    otpState,
    network,
    resetOtp,
    resetWorker,
    onSuccess: async (txId) => {
      onSuccess && onSuccess(txId)
      setTimeout(onClose, 2000)
    }
  })

  const doUndelegate = () => {
    if (stage >= 0) {
      return
    }
    const { otp, otp2, invalidOtp2, invalidOtp } = prepareValidation({
      state: { otpInput, otp2Input, doubleOtp }, checkAmount: false, checkDest: false,
    }) || {}

    if (invalidOtp || invalidOtp2) return

    // const { hash, bytes } = ONE.computeRecoveryHash({ hseed: ONEUtil.hexToBytes(wallet.hseed) })
    // const data = ONEUtil.hexString(bytes)
    // SmartFlows.commitReveal({
    //   wallet,
    //   otp,
    //   otp2,
    //   recoverRandomness,
    //   commitHashGenerator: () => ({ hash }),
    //   revealAPI: api.relayer.revealDataBased,
    //   revealArgs: { operationType: ONEConstants.OperationType.COLLECT_REWARD, data },
    //   ...handlers,
    // })

    const { bytes } = ONE.computeRecoveryHash({ hseed: ONEUtil.hexToBytes(wallet.hseed) })
    SmartFlows.commitReveal({
      wallet,
      otp,
      otp2,
      recoverRandomness,
      commitHashGenerator: ONE.computeGeneralOperationHash({ ...ONEConstants.NullOperationParams, operationType: ONEConstants.OperationType.COLLECT_REWARD, data: bytes }),
      revealAPI: api.relayer.reveal,
      revealArgs: { ...ONEConstants.NullOperationParams, operationType: ONEConstants.OperationType.COLLECT_REWARD, data: ONEUtil.hexString(bytes) },
      ...handlers,
    })
  }

  return (
    <StakeCommon isMobile={isMobile} network={network} onClose={onClose} address={address} titleSuffix='Collect Reward'>
      <Row align='middle' style={{ marginBottom: '32px' }}>
        <Text>
          This will collect all your accumulated rewards from all validators to your wallet. Please confirm.
        </Text>
      </Row>
      <RewardPanel address={address} isMobile={isMobile} />
      <Row align='middle'>
        <Col span={24}>
          <OtpStack
            walletName={autoWalletNameHint(wallet)}
            doubleOtp={doubleOtp}
            otpState={otpState}
            onComplete={doUndelegate}
            action='confirm collecting reward'
          />
        </Col>
      </Row>
      <CommitRevealProgress stage={stage} />
    </StakeCommon>
  )
}

export default CollectStateReward
