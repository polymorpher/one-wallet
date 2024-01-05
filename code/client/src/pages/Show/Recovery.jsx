import { Text, Hint, Title, Link, InputBox, InputPassword } from '../../components/Text'
import Button from 'antd/es/button'
import Col from 'antd/es/col'
import Row from 'antd/es/row'
import Space from 'antd/es/space'
import util, { downloadBlob, useWindowDimensions } from '../../util'
import WalletAddress from '../../components/WalletAddress'
import WarningOutlined from '@ant-design/icons/WarningOutlined'
import React, { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import Paths from '../../constants/paths'
import { useHistory } from 'react-router'
import { SimpleWalletExport, InnerTree } from '../../proto/wallet'
import message from '../../message'
import storage from '../../storage'
import { retryUpgrade } from './show-util'
import CheckOutlined from '@ant-design/icons/CheckOutlined'
import Spin from 'antd/es/spin'
import api from '../../api'
import EmailValidator from 'email-validator'

const Recovery = ({ address }) => {
  const dispatch = useDispatch()
  const history = useHistory()
  const wallets = useSelector(state => state.wallet)
  const wallet = wallets[address] || {}
  const { lastResortAddress, majorVersion, innerRoots, root } = wallet
  const { isMobile } = useWindowDimensions()
  const oneLastResort = util.safeOneAddress(lastResortAddress)
  const oneAddress = util.safeOneAddress(address)
  const isRecoveryFileSupported = majorVersion >= 15 && innerRoots?.length > 0

  const [cloudBackupProgress, setCloudBackupProgress] = useState(0)
  const [cloudBackupDone, setCloudBackupDone] = useState(false)
  const [cloudBackupExist, setCloudBackupExist] = useState(false)
  const [cloudBackupTime, setCloudBackupTime] = useState(0)
  const [cloudBackupExpired, setCloudBackupExpired] = useState(true)
  const [cloudBackupPanelVisible, setCloudBackupPanelVisible] = useState(false)
  const [username, setUsername] = useState('')
  const isUserNameEmail = EmailValidator.validate(username)
  const [password, setPassword] = useState('')

  const showRecovery = () => { history.push(Paths.showAddress(oneAddress, 'recover')) }

  const showSetRecoveryAddress = () => { history.push(Paths.showAddress(oneAddress, 'setRecoveryAddress')) }

  const createRecoveryBlob = async () => {
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
    try {
      const exportPB = SimpleWalletExport.create({
        name: wallet.name,
        address: wallet.address,
        expert: wallet.expert,
        innerTrees: innerTreePB,
      })
      const bytes = SimpleWalletExport.encode(exportPB).finish()
      const nameReplaced = wallet.name.replace(' ', '-').toLowerCase()
      const filename = `${nameReplaced}-${util.safeOneAddress(address)}.recover1wallet`
      const blob = new Blob([bytes])
      return { filename, blob }
    } catch (ex) {
      console.error(ex)
      message.error('Failed to encode recovery file data. Error:', ex.toString())
    }
  }
  const exportRecovery = async () => {
    const { filename, blob } = await createRecoveryBlob()
    downloadBlob(blob, filename)
  }

  const doCloudBackup = async () => {
    const { blob } = await createRecoveryBlob()
    const data = new FormData()
    data.append('file', blob)
    data.append('root', root)
    const onUploadProgress = (p) => {
      console.log('Upload progress: ', p.position / p.total)
      setCloudBackupProgress(p.position / p.total)
    }
    try {
      await api.backend.upload({
        data,
        username: isUserNameEmail ? undefined : username,
        email: isUserNameEmail ? username : undefined,
        password,
        root,
        address,
        onUploadProgress
      })
      setCloudBackupDone(true)
    } catch (ex) {
      message.error(`Cloud backup upload failed. Error: ${ex.toString()}`)
      setCloudBackupProgress(0)
      setCloudBackupDone(false)
    }
  }

  useEffect(() => {
    if (!address || !root) {
      return
    }
    const checkBackupInfo = async () => {
      const { timeUpdated, exist, root: backupRoot } = await api.backend.info({ address })
      setCloudBackupTime(timeUpdated)
      setCloudBackupExist(exist)
      console.log({ backupRoot, root })
      setCloudBackupExpired(exist && (root !== backupRoot))
    }
    checkBackupInfo().catch((ex) => {
      message.error('Unable to check backup info')
      console.error(ex)
    })
  }, [cloudBackupDone, address, root])

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
            {!cloudBackupPanelVisible && <Button size='large' shape='round' onClick={() => setCloudBackupPanelVisible(true)} disabled={cloudBackupExist}> Cloud Backup {cloudBackupExist && <CheckOutlined />}</Button>}
          </Space>
        </Col>
      </Row>
      <form action='#' onSubmit={doCloudBackup}>
        {cloudBackupPanelVisible && (
          <>
            <Row style={{ display: 'flex', width: '100%', columnGap: 16 }}>
              <InputBox
                size='large'
                margin='8px'
                $marginBottom='0px'
                placeholder='username or email'
                style={{ flex: 1 }}
                value={username}
                autoComplete='email'
                onChange={({ target: { value } }) => setUsername(value)}
              />
              <InputPassword
                size='large'
                margin='8px'
                $marginBottom='0px'
                placeholder='password'
                autoComplete='password'
                style={{ flex: 1 }}
                value={password}
                onChange={({ target: { value } }) => setPassword(value)}
              />
            </Row>
            <Row justify='center' style={{ width: '100%', marginTop: 16, marginBottom: 16 }}>
              <Button size='large' shape='round' onClick={doCloudBackup} disabled={cloudBackupProgress > 0}>
                Make Cloud Backup {!cloudBackupDone && cloudBackupProgress > 0 &&
                  <>
                    <Spin style={{ marginLeft: 8, marginRight: 8 }} />
                    {(cloudBackupProgress * 100).toFixed(0)} %
                  </>} {cloudBackupDone && <CheckOutlined />}
              </Button>
            </Row>
          </>)}
      </form>
      {cloudBackupExist && !cloudBackupExpired && <Text style={{ color: 'green' }}>A cloud backup of the recovery file was made on {new Date(cloudBackupTime).toLocaleString()}</Text>}
      {cloudBackupExist && cloudBackupExpired && <Text style={{ color: 'red' }}>The recovery file's cloud backup is expired (made on {new Date(cloudBackupTime).toLocaleString()})</Text>}
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
