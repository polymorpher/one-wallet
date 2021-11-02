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
const { Title, Text } = Typography

const CheckRoots = ({ address, onClose }) => {
  const { isMobile } = useWindowDimensions()
  const history = useHistory()
  const { dispatch, wallets, wallet } = useWallet({ address })
  const { oldInfos, root, lastResortAddress } = wallet
  const [rootMissing, setRootMissing] = useState(false)
  const [oldRootExist, setOldRootExist] = useState(false)
  const [skip, setSkip] = useState(false)
  useEffect(() => {
    const f = async () => {
      if (!root) {
        return
      }
      const layers = await storage.getItem(root)
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

  if (skip || !rootMissing) {
    return <></>
  }

  if (oldRootExist) {
    return (
      <FloatContainer>
        <AverageRow justify='center'>
          <Title level={isMobile ? 4 : 2}>Wallet renewed elsewhere</Title>
          <Text>This wallet has been renewed on other devices.</Text>
          {util.isRecoveryAddressSet(lastResortAddress) && <Text>You may still use "Recovery" feature here (if you previously set a recovery address).</Text>}
          <Text>To use the wallet, please delete and restore this wallet.</Text>
        </AverageRow>
        <AverageRow justify='center'>
          <Space direction='vertical' size='large' align='center'>
            <Button type='primary' shape='round' onClick={onClose}>Exit</Button>
            {util.isRecoveryAddressSet(lastResortAddress) && <Button type='default' shape='round' onClick={() => setSkip(true)}>Inspect Wallet</Button>}
            <Popconfirm title='Are you sure？' onConfirm={() => deleteWalletLocally({ wallet, wallets, history, dispatch })}>
              <Button type='text' shape='round' danger size='large' icon={<DeleteOutlined />}>Delete Locally</Button>
            </Popconfirm>
          </Space>
        </AverageRow>
      </FloatContainer>
    )
  }
  const deleteAndRestore = async () => {
    await deleteWalletLocally({ wallet, wallets, history, dispatch })
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
