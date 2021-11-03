import React, { useEffect, useState } from 'react'
import util, { useWindowDimensions } from '../../util'
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
const { Title, Text } = Typography

const CheckRoots = ({ address, onClose }) => {
  const { isMobile } = useWindowDimensions()
  const history = useHistory()
  const { dispatch, wallets, wallet } = useWallet({ address })
  const { oldInfos, root, lastResortAddress, acknowledgedRoot } = wallet
  const [rootMissing, setRootMissing] = useState(false)
  const [oldRootExist, setOldRootExist] = useState(false)
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
          const oldLayers = await storage.getItem(root)
          if (oldLayers) {
            setOldRootExist(true)
          }
        }
      }
    }
    f()
  }, [wallet?.root, wallet?.oldInfos])

  const onAcknowledgeRoot = () => {
    dispatch(walletActions.userAcknowledgedNewRoot({ address, root }))
    setSkip(true)
  }
  if (skip || !rootMissing) {
    return <></>
  }

  if (oldRootExist) {
    if (acknowledgedRoot === root) {
      return <></>
    }
    return (
      <FloatContainer>
        <AverageRow justify='center'>
          <Title level={isMobile ? 4 : 2}>Wallet renewed elsewhere</Title>
          <Text>This wallet has been renewed on other devices.</Text>
          <Text style={{ color: 'red' }}>If you didn't do this, this means someone else may registered another authenticator code with this wallet, and they may use the wallet. Please recover or transfer assets as soon as possible.</Text>
        </AverageRow>
        <AverageRow justify='center'>
          <Space direction='vertical' size='large' align='center'>
            <Button type='primary' shape='round' onClick={onAcknowledgeRoot}>I understand</Button>
          </Space>
        </AverageRow>
      </FloatContainer>
    )
  }
  const deleteAndRestore = async () => {
    await deleteWalletLocally({ wallet, wallets, dispatch })
    history.push(Paths.restore)
  }
  const custom = (
    <Space direction='vertical'>
      <Text>This wallet cannot be used because its local storage is corrupted. Please delete the wallet, then restore it</Text>
      <AverageRow justify='center'>
        <Popconfirm title='Are you sure？' onConfirm={() => deleteAndRestore()}>
          <Button type='text' shape='round' danger size='large' icon={<DeleteOutlined />}>Delete And Restore</Button>
        </Popconfirm>
      </AverageRow>
    </Space>
  )
  // return (
  //   <Warning custom={custom} />
  // )
  return (
    <FloatContainer>
      {custom}
    </FloatContainer>
  )
}
export default CheckRoots
