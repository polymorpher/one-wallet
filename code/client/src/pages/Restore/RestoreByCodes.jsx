import { Button, Space, Row } from 'antd'
import { Text, Title } from '../../components/Text'
import { OtpSuperStack } from '../../components/OtpSuperStack'
import React, { useEffect, useState } from 'react'
import { useWindowDimensions } from '../../util'
import ShowUtils from '../Show/show-util'
import ONEConstants from '../../../../lib/constants'
import { EotpBuilders, SmartFlows } from '../../../../lib/api/flow'
import ONE from '../../../../lib/onewallet'
import ONEUtil from '../../../../lib/util'
import { api } from '../../../../lib/api'
import { useSelector, useDispatch } from 'react-redux'
import { useOtpState } from '../../components/OtpStack'
import message from '../../message'
import WalletCreateProgress from '../../components/WalletCreateProgress'
import storage from '../../storage'
import walletActions from '../../state/modules/wallet/actions'
import WalletConstants from '../../constants/wallet'
import { CommitRevealProgress } from '../../components/CommitRevealProgress'

// new core params should be already computed, and wallet info already retrieved from blockchain
const RestoreByCodes = ({ isActive, wallet, innerTrees, innerCores, newCoreParams, onComplete, onCancel, progressStage, progress, expert }) => {
  const [stage, setStage] = useState(-1)
  const { isMobile } = useWindowDimensions()
  const network = useSelector(state => state.wallet.network)
  const otpStates = new Array(6).fill(0).map(() => useOtpState().state)
  const [otpComplete, setOtpComplete] = useState(false)
  const dispatch = useDispatch()

  const resetOtps = () => {
    for (let i = otpStates.length - 1; i >= 0; i--) {
      otpStates[i].resetOtp(i > 0)
    }
    setOtpComplete(false)
    setStage(-1)
  }

  const { prepareValidation, ...handlers } = ShowUtils.buildHelpers({
    setStage,
    resetOtp: resetOtps,
    network,
    onSuccess: async () => {
      // TODO: saving new wallet locally, store layers and innerLayers spawned from newCore
      const promises = []
      message.info('Saving your wallet...')
      for (const tree of innerTrees) {
        const innerRoot = tree[tree.length - 1]
        const hex = ONEUtil.hexView(innerRoot)
        console.log(`Storing innerTree ${hex}`)
        promises.push(storage.setItem(hex, tree))
      }
      await Promise.all(promises)
      console.log(`${promises.length} innerTrees stored`)
      const { layers, hseed, doubleOtp, name } = newCoreParams
      const { root } = wallet
      console.log(`Storing tree ${root}`)
      await storage.setItem(root, layers)
      const newWallet = {
        _merge: true,
        ...wallet,
        name,
        hseed: ONEUtil.hexView(hseed),
        doubleOtp,
        network,
        innerRoots: innerTrees.map(layers => ONEUtil.hexView(layers[0])),
        expert,
      }
      const securityParameters = ONEUtil.securityParameters(newWallet)
      const walletUpdate = { ...newWallet, ...securityParameters }
      dispatch(walletActions.updateWallet(walletUpdate))
      onComplete && onComplete()
    }
  })

  const doDisplace = async () => {
    if (!newCoreParams) {
      console.error('Not ready yet: newCoreParams')
      return
    }
    const { core: coreRaw, innerCores: newInnerCoresRaw, identificationKeys } = newCoreParams
    if (!newCoreParams) {
      message.error('Must generate new core first')
      return
    }
    const data = ONE.encodeDisplaceDataHex({ core: coreRaw, innerCores: newInnerCoresRaw, identificationKey: identificationKeys[0] })
    const otps = otpStates.map(({ otpInput }) => parseInt(otpInput))
    const eotp = await EotpBuilders.restore({ otp: otps })
    const expectedLeaf = ONEUtil.sha256(eotp)
    // console.log({ expectedLeaf, eotp })
    const maxIndex = ONEUtil.timeToIndex({ effectiveTime: innerCores[0].effectiveTime, interval: WalletConstants.interval6 })
    // const treeIndex = ONEUtil.timeToIndex({ effectiveTime: wallet.effectiveTime }) % innerTrees.length

    let index = null
    let treeIndex = null
    setStage(0)
    const maxIndexAcrossTrees = Math.max(...innerTrees.map(t => t[0].length / 32))
    console.log({ maxIndex, maxIndexAcrossTrees })
    for (let i = Math.min(maxIndexAcrossTrees - 1, maxIndex + 1); i >= 0; i--) {
    // for (let i = 0; i < maxIndexAcrossTrees; i++) {
      for (const [ind, innerTree] of innerTrees.entries()) {
        const layer = innerTree[0]
        const b = new Uint8Array(layer.subarray(i * 32, i * 32 + 32))
        if (ONEUtil.bytesEqual(b, expectedLeaf)) {
          index = i
          treeIndex = ind
          console.log(`Matching tree index ${treeIndex} at position ${index}`)
          break
          // console.log(`Matching index: ${ind} (expected ${treeIndex}), at ${i} (expected ${index})`)
        }
      }
      if (index !== null && treeIndex !== null) {
        break
      }
    }
    if (index === null || treeIndex === null) {
      message.error('Code is incorrect. Please start over.')
      resetOtps()
      return
    }
    const layers = innerTrees[treeIndex]
    SmartFlows.commitReveal({
      wallet,
      otp: otps,
      eotpBuilder: EotpBuilders.restore,
      index,
      layers,
      commitHashGenerator: ONE.computeDataHash,
      commitHashArgs: { data: ONEUtil.hexStringToBytes(data) },
      prepareProof: () => setStage(0),
      beforeCommit: () => setStage(1),
      afterCommit: () => setStage(2),
      revealAPI: api.relayer.reveal,
      revealArgs: { ...ONEConstants.NullOperationParams, data, operationType: ONEConstants.OperationType.DISPLACE },
      overrideVersion: true,
      ...handlers
    })
  }

  useEffect(() => {
    if (!newCoreParams || !otpComplete) {
      return
    }
    doDisplace()
  }, [otpComplete, newCoreParams])

  return (
    <Space direction='vertical' size='large' style={{ width: '100%' }}>
      <Title level={2}>Restore: Step 3/3</Title>
      <Text>Please provide <b>the original</b> authenticator codes, 6-digit at a time, every time you get a new one. Please make sure you do not miss any (in which case you need to start over). Please make sure you use the original code, not the one you just scanned.</Text>
      <OtpSuperStack
        otpStates={otpStates}
        action='submit for validation'
        wideLabel={isMobile}
        shouldAutoFocus={isActive}
        onComplete={() => setOtpComplete(true)}
        isDisabled={stage >= 0}
      />
      {!newCoreParams && otpComplete && <WalletCreateProgress progress={progress} isMobile={isMobile} progressStage={progressStage} subtitle='Rebuilding your 1wallet' />}
      {stage >= 0 && <CommitRevealProgress stage={stage} style={{ marginTop: 32 }} />}
      <Row justify='space-between'>
        <Button size='large' type='text' onClick={onCancel} danger>Cancel</Button>
        <Button size='large' type='default' shape='round' onClick={resetOtps}>Reset</Button>
        <span />
      </Row>
    </Space>
  )
}
export default RestoreByCodes
