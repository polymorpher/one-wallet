import Button from 'antd/es/button'
import Row from 'antd/es/row'
import Space from 'antd/es/space'
import Typography from 'antd/es/typography'
import { CommitRevealProgress } from '../../components/CommitRevealProgress'
import AnimatedSection from '../../components/AnimatedSection'
import React, { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import ONE from '../../../../lib/onewallet'
import ONEUtil from '../../../../lib/util'
import { EotpBuilders, SmartFlows } from '../../../../lib/api/flow'
import { api } from '../../../../lib/api'
import ShowUtils from './show-util'
import { walletActions } from '../../state/modules/wallet'

const { Title, Text } = Typography
const DoRecover = ({ address, onClose }) => {
  const wallets = useSelector(state => state.wallet)
  const wallet = wallets[address] || {}
  const { lastResortAddress } = wallet
  const [stage, setStage] = useState(-1)
  const network = useSelector(state => state.global.network)
  const dispatch = useDispatch()

  const helpers = ShowUtils.buildHelpers({
    setStage,
    network,
    onSuccess: () => {
      dispatch(walletActions.updateWallet({ ...wallet, recoveryTime: Date.now() }))
      onClose && onClose()
    }
  })

  const doRecovery = async () => {
    let { hash, bytes } = ONE.computeRecoveryHash({ hseed: ONEUtil.hexToBytes(wallet.hseed) })
    if (!(wallet.majorVersion >= 8)) {
      // contracts <= v7 rely on paramsHash = bytes32(0) for recover, so we must handle this special case here
      hash = new Uint8Array(32)
    }
    const eotpBuilder = wallet.majorVersion >= 8 ? EotpBuilders.recovery : EotpBuilders.legacyRecovery
    SmartFlows.commitReveal({
      recoverRandomness: () => 0,
      wallet,
      eotpBuilder,
      index: -1,
      commitHashGenerator: () => ({ hash, bytes: new Uint8Array(0) }), // Only legacy committer uses `bytes`. It mingles them with other parameters to produce hash. legacy recover has no parameters, therefore `bytes` should be empty byte array
      revealAPI: api.relayer.revealRecovery,
      commitRevealArgs: { data: bytes },
      ...helpers
    })
  }
  return (
    <AnimatedSection wide title={<Title level={2}>Recover</Title>} onClose={onClose}>
      {lastResortAddress &&
        <>
          <Space direction='vertical' size='large'>
            <Title level={2}>Your funds are safe</Title>
            <Text>Since you already set a recover address, we can send all your remaining funds to that address.</Text>
            <Text>Do you want to proceed?</Text>
          </Space>
          <Row justify='end' style={{ marginTop: 48 }}>
            <Button type='primary' size='large' shape='round' disabled={stage >= 0} onClick={doRecovery}>Sounds good!</Button>
          </Row>
          <CommitRevealProgress stage={stage} />
        </>}
      {!lastResortAddress &&
        <Space direction='vertical' size='large'>
          <Title level={2}>Your funds are safe</Title>
          <Text>You did not set a recovery address. We can still set one, using pre-computed proofs stored in your browser</Text>
          <Text>Please go back and check again once you finished.</Text>
        </Space>}

    </AnimatedSection>
  )
}
export default DoRecover
