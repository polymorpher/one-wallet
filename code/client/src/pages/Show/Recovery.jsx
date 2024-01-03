import { Text, Hint, Title, Link } from '../../components/Text'
import Button from 'antd/es/button'
import Col from 'antd/es/col'
import Row from 'antd/es/row'
import Space from 'antd/es/space'
import util, { useWindowDimensions } from '../../util'
import WalletAddress from '../../components/WalletAddress'
import WarningOutlined from '@ant-design/icons/WarningOutlined'
import React, { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import Paths from '../../constants/paths'
import { useHistory } from 'react-router'
import { SimpleWalletExport, InnerTree } from '../../proto/wallet'
import message from '../../message'
import storage from '../../storage'
import { retryUpgrade } from './show-util'
import CheckOutlined from '@ant-design/icons/CheckOutlined'
const Recovery = ({ address }) => {
  const dispatch = useDispatch()
  const history = useHistory()
  const wallets = useSelector(state => state.wallet)
  const wallet = wallets[address] || {}
  const { lastResortAddress, majorVersion, innerRoots } = wallet
  const { isMobile } = useWindowDimensions()
  const oneLastResort = util.safeOneAddress(lastResortAddress)
  const oneAddress = util.safeOneAddress(address)
  const isRecoveryFileSupported = majorVersion >= 15 && innerRoots?.length > 0

  const [cloudBackupProgress, setCloudBackupProgress] = useState(0)
  const [cloudBackupExist, setCloudBackupExist] = useState(false)
  const [cloudBackupExpired, setCloudBackupExpired] = useState(true)
  const doCloudBackup = () => {

  }

  const showRecovery = () => { history.push(Paths.showAddress(oneAddress, 'recover')) }

  const showSetRecoveryAddress = () => { history.push(Paths.showAddress(oneAddress, 'setRecoveryAddress')) }

  const exportRecovery = async () => {
    if (!isRecoveryFileSupported) {
      message.error('Only available for wallets created after v15, or wallets upgraded to v15 and extended its lifespan')
      return
    }
    const innerTrees = await Promise.all(innerRoots.map(r => storage.getItem(r)))
    if (innerTrees.filter(e => e).length !== innerTrees.length) {
      message.error('Storage is corrupted. Please restore the wallet using some other way')
      return
    }
    const innerTreePB = innerTrees.map(layers => InnerTree.create({ layers }))
    let element
    try {
      const exportPB = SimpleWalletExport.create({
        name: wallet.name,
        address: wallet.address,
        expert: wallet.expert,
        innerTrees: innerTreePB,
      })
      const bytes = SimpleWalletExport.encode(exportPB).finish()
      console.log(bytes.length)
      const nameReplaced = wallet.name.replace(' ', '-').toLowerCase()
      const filename = `${nameReplaced}-${util.safeOneAddress(address)}.recover1wallet`
      const file = new Blob([bytes])
      element = document.createElement('a')
      element.download = filename
      element.href = URL.createObjectURL(file)
      document.body.appendChild(element)
      element.click()
    } catch (ex) {
      console.error(ex)
      message.error('Failed to encode recovery file data. Error:', ex.toString())
    } finally {
      if (element.href) URL.revokeObjectURL(element.href)
      if (element) {
        document.body.removeChild(element)
      }
    }
  }

  return (
    <Space direction='vertical' size='large' style={{ width: '100%' }}>
      <Row align='middle'>
        <Col span={isMobile ? 24 : 10}> <Title level={3}>Recovery Address</Title></Col>
        {lastResortAddress && !util.isEmptyAddress(lastResortAddress) &&
          <Col>
            <WalletAddress
              showLabel
              address={oneLastResort}
              shorten
            />
          </Col>}
      </Row>
      <Row align='baseline'>
        <Col span={isMobile ? 24 : 10}><span /></Col>
        {!util.isRecoveryAddressSet(lastResortAddress) &&
          <Col>
            <Button type='primary' size='large' shape='round' onClick={showSetRecoveryAddress}> Change </Button>
          </Col>}
      </Row>
      <Hint>You may send all your assets to your recovery address if you lost your authenticator. You can also recover your assets by sending 1.0 ONE from the recovery address to this wallet, after the wallet is idle for at least 14 days. If your recovery address is <b>1wallet DAO</b>, it means your recovery address is not yet set.</Hint>
      {util.isRecoveryAddressSet(lastResortAddress) &&
        <Row justify='end'>
          <Button type='primary' size='large' shape='round' onClick={showRecovery} icon={<WarningOutlined />}>Recover funds</Button>
        </Row>}
      <Row align='baseline' style={{ marginTop: 32 }}>
        <Col span={isMobile ? 24 : 10}> <Title level={3}>Recovery File</Title></Col>
        <Col>
          <Space>
            <Button type='primary' size='large' shape='round' onClick={exportRecovery} disabled={!isRecoveryFileSupported}> Download </Button>
            <Button size='large' shape='round' onClick={doCloudBackup} disabled={cloudBackupExist}> Cloud Backup {cloudBackupExist && <CheckOutlined />}</Button>
          </Space>
        </Col>
      </Row>
      {cloudBackupExist && !cloudBackupExpired && <Text>A cloud backup of the recovery file was made on {cloudBackupTime}</Text>}
      {cloudBackupExpired && <Text style={{ color: 'red' }}>The cloud backup of the recovery file was expired (made on {cloudBackupTime})</Text>}
      {!isRecoveryFileSupported &&
        <Text style={{ color: 'red' }}>
          Recovery file is only available to wallets created from v15, or wallets upgraded to v15 then renewed.
          {majorVersion >= 15 ? <Link onClick={() => history.push(Paths.showAddress(address, 'extend'))}>(renew now)</Link> : <Link onClick={() => retryUpgrade({ dispatch, history, address })}> (upgrade now, then renew)</Link>}
        </Text>}
      <Hint>You can use the recovery file and your authenticator to restore your wallet on any device. You do not need to keep this file confidential, because it cannot be used without your authenticator - the correct 6-digit authenticator code is required for six consecutive times. Feel free to upload this file in any personal or public storage, such as Google Drive, iCloud, IPFS, Keybase.</Hint>

    </Space>
  )
}
export default Recovery
