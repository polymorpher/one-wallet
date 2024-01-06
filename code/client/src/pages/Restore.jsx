import React, { useState } from 'react'
import ScanOutlined from '@ant-design/icons/ScanOutlined'
import FieldBinaryOutlined from '@ant-design/icons/FieldBinaryOutlined'
import { useHistory } from 'react-router'
import { Heading, Hint } from '../components/Text'
import AnimatedSection from '../components/AnimatedSection'
import Space from 'antd/es/space'
import Button from 'antd/es/button'
import Divider from 'antd/es/divider'
import message from '../message'
import Paths from '../constants/paths'
import RestoreByCodes from './Restore/RestoreByCodes'
import SyncRecoveryFile from './Restore/SyncRecoveryFile'
import SetupNewCode from './Restore/SetupNewCode'
import LocalImport from '../components/LocalImport'
import RestoreByScan from './Restore/RestoreByScan'
import { retrieveWalletInfoFromAddress } from './Restore/Common'
import { api } from '../../../lib/api'

const Sections = {
  Choose: 0,
  ScanQR: 1,
  SyncRecoveryFile: 2,
  SetupNewCode: 3,
  RecoveryCode: 4,
}

const Restore = () => {
  const history = useHistory()
  const [section, setSection] = useState(Sections.Choose)

  const [walletInfo, setWalletInfo] = useState()

  const [progress, setProgress] = useState(0)
  const [progressStage, setProgressStage] = useState(0)
  const [innerTrees, setInnerTrees] = useState()
  const [innerCores, setInnerCores] = useState()
  const [expert, setExpert] = useState()
  const [name, setName] = useState()
  const [newLocalParams, setNewLocalParams] = useState()
  const [address, setAddress] = useState()

  const onSynced = async ({ name, address: retrievalAddress, innerTrees, expert }) => {
    try {
      const { wallet } = await retrieveWalletInfoFromAddress(retrievalAddress)
      const innerCores = await api.blockchain.getInnerCores({ address: retrievalAddress })
      setInnerCores(innerCores)
      setName(name)
      setAddress(retrievalAddress)
      setWalletInfo(wallet)
      setExpert(expert)
      setInnerTrees(innerTrees)
      setSection(Sections.SetupNewCode)
    } catch (ex) {
      console.error(ex)
      message.error('Please reselect recovery file and try again.')
    }
  }

  return (
    <>
      {section === Sections.Choose &&
        <AnimatedSection>
          <Space direction='vertical' size='large' style={{ width: '100%' }}>
            <Heading>Scan authenticator export QR code</Heading>
            <Button shape='round' size='large' type='primary' onClick={() => setSection(Sections.ScanQR)} icon={<ScanOutlined />}>Scan Now</Button>
            <Hint>Export QR Code from Authenticator, scan using webcam, or provide secret directly (Best with Google / Aegis / Raivo Authenticator)</Hint>
          </Space>
          <Divider><Hint>Or</Hint></Divider>
          <Space direction='vertical' size='large' style={{ width: '100%' }}>
            <Heading>Use recovery file and authenticator</Heading>
            <Button shape='round' size='large' type='primary' onClick={() => setSection(Sections.SyncRecoveryFile)} icon={<FieldBinaryOutlined />}>Begin</Button>
            <Hint>Upload recovery file and provide 6-digit verification codes for 6 times. Setup a new authenticator code after this.</Hint>
          </Space>
          <Divider><Hint>Or</Hint></Divider>
          <Space direction='vertical' size='large'>
            <Heading>Sync 1wallet across devices</Heading>
            <LocalImport />
            <Hint>Export .1wallet file under "About" tab from another device. Does not require authenticator. It is recommended to delete the file after this.</Hint>
          </Space>
        </AnimatedSection>}
      {section === Sections.ScanQR &&
        <AnimatedSection>
          <RestoreByScan isActive={section === Sections.ScanQR} onCancel={() => setSection(Sections.Choose)} />
        </AnimatedSection>}
      {section === Sections.SyncRecoveryFile &&
        <AnimatedSection>
          <SyncRecoveryFile
            onSynced={onSynced}
            onCancel={() => setSection(Sections.Choose)}
          />
        </AnimatedSection>}
      {(section === Sections.SetupNewCode || section === Sections.RecoveryCode) &&
        <AnimatedSection show={section === Sections.SetupNewCode}>
          <SetupNewCode
            wallet={walletInfo}
            name={name}
            expert={expert}
            active={section === Sections.SetupNewCode}
            onComplete={() => setSection(Sections.RecoveryCode)}
            onCancel={() => setSection(Sections.Choose)}
            onProgressUpdate={({ progress, stage }) => { setProgress(progress); setProgressStage(stage) }}
            onComputeLocalParams={e => {
              // console.log(e)
              setNewLocalParams(e)
            }}
          />
        </AnimatedSection>}
      {section === Sections.RecoveryCode &&
        <AnimatedSection>
          <RestoreByCodes
            name={name}
            progress={progress}
            expert={expert}
            progressStage={progressStage}
            isActive={section === Sections.RecoveryCode}
            onComplete={() => {
              message.info('Redirecting to your wallet in 2 seconds...')
              setTimeout(() => history.push(Paths.showAddress(address)), 2000)
            }}
            onCancel={() => setSection(Sections.Choose)}
            newLocalParams={newLocalParams}
            wallet={walletInfo}
            innerTrees={innerTrees}
            innerCores={innerCores}
          />
        </AnimatedSection>}
    </>
  )
}
export default Restore
