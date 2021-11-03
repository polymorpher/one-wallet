import React, { useCallback, useEffect, useState } from 'react'
import util, { useWindowDimensions } from '../../util'
import WalletConstants from '../../constants/wallet'
import { Button, Typography, Space, Popconfirm } from 'antd'
import storage from '../../storage'
import { useHistory } from 'react-router'
import Paths from '../../constants/paths'
import { DeleteOutlined } from '@ant-design/icons'
import { deleteWalletLocally } from '../../storage/util'
import { useWallet } from '../../components/Common'
import { AverageRow } from '../../components/Grid'
import { FloatContainer } from '../../components/Layout'
import { walletActions } from '../../state/modules/wallet'
import humanizeDuration from 'humanize-duration'
import WalletAddress from '../../components/WalletAddress'
import { api } from '../../../../lib/api'
import config from '../../config'
import message from '../../message'
import { doRetire } from './show-util'
const { Title, Text, Link } = Typography

const CheckRoots = ({ address, onClose }) => {
  const { isMobile } = useWindowDimensions()
  const history = useHistory()
  const { dispatch, wallets, wallet } = useWallet({ address })
  const { oldInfos, root, acknowledgedNewRoot, effectiveTime, duration, lastResortAddress, network } = wallet
  const [rootMissing, setRootMissing] = useState(false)
  const [oldRootExist, setOldRootExist] = useState(null)
  const [oldRootExpiry, setOldRootExpiry] = useState(WalletConstants.defaultDuration)
  const [skip, setSkip] = useState(false)
  useEffect(() => {
    const f = async () => {
      if (!root) {
        return
      }
      const layers = await storage.getItem(root)
      // console.log(root, layers, address)
      if (!layers) {
        setRootMissing(true)
      }
      if (oldInfos?.length > 0) {
        for (const info of oldInfos) {
          if (!info.root) {
            console.error(`No root exists in old core of address ${address}`, info)
            continue
          }
          const oldLayers = await storage.getItem(info.root)
          if (oldLayers) {
            setOldRootExist(true)
            const oldExpiry = info.effectiveTime + info.duration
            const timeToExpiry = oldExpiry - Date.now()
            setOldRootExpiry(timeToExpiry)
            return
          }
          setOldRootExist(false)
        }
      }
    }
    f()
  }, [root, oldInfos])
  const deleteAndRestore = async () => {
    await deleteWalletLocally({ wallet, wallets, dispatch })
    history.push(Paths.restore)
  }
  const onAcknowledgeRoot = () => {
    dispatch(walletActions.userAcknowledgedNewRoot({ address, root }))
  }

  const DeleteAndRestore = useCallback(({ title, options }) => {
    return (
      <FloatContainer>
        <Space direction='vertical'>
          <Text>{title}</Text>
          <AverageRow justify='center'>
            {options}
            <Popconfirm title='Are you sure？' onConfirm={() => deleteAndRestore()}>
              <Button type='text' shape='round' danger size='large' icon={<DeleteOutlined />}>Delete And Restore</Button>
            </Popconfirm>
          </AverageRow>
        </Space>
      </FloatContainer>
    )
  }, [])

  if (skip) {
    return <></>
  }
  // console.log(rootMissing, oldRootExist)
  if (!rootMissing) {
    const timeToExpire = (effectiveTime + duration) - Date.now()
    if (timeToExpire <= 0) {
      return (
        <FloatContainer>
          <Text>This wallet cannot be used because it expired {humanizeDuration(-timeToExpire, { units: ['y', 'mo', 'd'], round: true })} ago </Text>
          <Text>You may transfer all its assets to its recovery address:</Text>
          <WalletAddress showLabel address={lastResortAddress} alwaysShowOptions />
          <Space direction='vertical' size='large' align='center' style={{ width: '100%' }}>
            <Button type='primary' shape='round' onClick={() => doRetire({ address, network })}>Confirm</Button>
            <Button shape='round' onClick={() => setSkip(true)}>Inspect Wallet</Button>
            <Button shape='round' onClick={onClose}>Exit</Button>
          </Space>
        </FloatContainer>
      )
    } else if (timeToExpire < WalletConstants.expiringSoonThreshold) {
      return (
        <FloatContainer>
          <Text>This wallet is expiring in {humanizeDuration(timeToExpire, { units: ['y', 'mo', 'd'], round: true })}. After it is expired, it can only transfer remaining assets to the recovery address</Text>
          <Text>Renew it?</Text>
          <Space direction='vertical' size='large' align='center' style={{ width: '100%' }}>
            <Button type='primary' shape='round' onClick={() => history.push(Paths.showAddress(address, 'extend'))}>Yes</Button>
            <Button shape='round' onClick={() => setSkip(true)}>Later</Button>
          </Space>
        </FloatContainer>
      )
    }
    return <></>
  }

  if (oldRootExist === null) {
    // do not block ui while we are checking stuff
    return <></>
  }
  if (oldRootExist) {
    if (acknowledgedNewRoot === root) {
      if (oldRootExpiry < 0) {
        return (<DeleteAndRestore title='This wallet cannot be used on this device. It is renewed elsewhere and its local data is expired. To use it on this device, please delete the wallet, then restore it' />)
      }
      if (oldRootExpiry < 3600 * 1000 * 24 * 30) {
        return (<DeleteAndRestore title={`This wallet was renewed elsewhere. It is expiring in ${humanizeDuration(oldRootExpiry, { units: ['y', 'mo', 'd'], round: true })} on this device. To continue using it on this device, please delete the wallet, then restore it`} options={<Button type='primary' shape='round' onClick={() => setSkip(true)}>Remind me next time</Button>} />)
      }
      return <></>
    }
    return (
      <FloatContainer>
        <Space direction='vertical'>
          <Title level={isMobile ? 4 : 2}>Wallet renewed elsewhere</Title>
          <Text>This wallet has been renewed on other devices.</Text>
          <Text style={{ color: 'red' }}>If you didn't do this, this means someone else may registered another authenticator code with this wallet, and they may use the wallet. Please recover or transfer assets as soon as possible.</Text>
        </Space>
        <AverageRow justify='center'>
          <Space direction='vertical' size='large' align='center'>
            <Button type='primary' shape='round' onClick={onAcknowledgeRoot}>I understand</Button>
          </Space>
        </AverageRow>
      </FloatContainer>
    )
  }

  return (<DeleteAndRestore title='This wallet cannot be used because its local storage is corrupted. Please delete the wallet, then restore it' />)
}
export default CheckRoots
