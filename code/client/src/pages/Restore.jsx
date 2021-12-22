import React, { useState } from 'react'
import { ScanOutlined, FieldBinaryOutlined } from '@ant-design/icons'
import { useHistory } from 'react-router'
import { Heading, Hint } from '../components/Text'
import AnimatedSection from '../components/AnimatedSection'
import { Space, Button, Divider } from 'antd'
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
      <AnimatedSection show={section === Sections.Choose}>
        <Space direction='vertical' size='large' style={{ width: '100%' }}>
          <Heading>Use auth codes + recovery file</Heading>
          <Button shape='round' size='large' type='primary' onClick={() => setSection(Sections.SyncRecoveryFile)} icon={<FieldBinaryOutlined />}>Begin</Button>
          <Hint>You need (1) wallet recovery file (2) your authenticator. You will be asked to provide type 6-digit code for 6 times (30 seconds each). You need to setup a new authenticator code after that</Hint>
        </Space>
        <Divider><Hint>Or</Hint></Divider>
        <Space direction='vertical' size='large'>
          <Heading>Synchronize 1wallet across devices</Heading>
          <LocalImport />
          <Hint>Easiest but less secure. This is best for synchronization across multiple devices. To use this, you need the file you exported under "About" tab.</Hint>
        </Space>
        <Divider><Hint>Or</Hint></Divider>
        <Space direction='vertical' size='large' style={{ width: '100%' }}>
          <Heading>Scan authenticator seed QR code</Heading>
          <Button shape='round' size='large' type='primary' onClick={() => setSection(Sections.ScanQR)} icon={<ScanOutlined />}>Scan Now</Button>
          <Hint>Fast and secure, best for advanced users. Use your webcam to scan QR code exported from your authenticator (Google and Aegis Authenticator only)</Hint>
        </Space>

      </AnimatedSection>
      <AnimatedSection show={section === Sections.ScanQR}>
        <RestoreByScan isActive={section === Sections.ScanQR} onCancel={() => setSection(Sections.Choose)} />
      </AnimatedSection>
      <AnimatedSection show={section === Sections.SyncRecoveryFile}>
        <SyncRecoveryFile
          onSynced={onSynced}
          onCancel={() => setSection(Sections.Choose)}
        />
      </AnimatedSection>
      <AnimatedSection show={section === Sections.SetupNewCode}>
        <SetupNewCode
          wallet={walletInfo}
          name={name}
          expert={expert}
          active={section === Sections.SetupNewCode}
          onComplete={() => setSection(Sections.RecoveryCode)}
          onCancel={() => setSection(Sections.Choose)}
          onProgressUpdate={({ progress, stage }) => { setProgress(progress); setProgressStage(stage) }}
          onComputeLocalParams={e => setNewLocalParams(e)}
        />
      </AnimatedSection>
      <AnimatedSection show={section === Sections.RecoveryCode}>
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
          newCoreParams={newLocalParams}
          wallet={walletInfo}
          innerTrees={innerTrees}
          innerCores={innerCores}
        />
      </AnimatedSection>
    </>
  )
}
export default Restore
