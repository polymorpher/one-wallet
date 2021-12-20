import React, { useState, useEffect } from 'react'
import { ScanOutlined, FieldBinaryOutlined, ImportOutlined } from '@ant-design/icons'
import { useHistory } from 'react-router'
import { Heading, Hint } from '../components/Text'
import AnimatedSection from '../components/AnimatedSection'
import { Space, Progress, Button, Divider } from 'antd'
import message from '../message'
import api from '../api'
import ONEUtil from '../../../lib/util'
import WalletConstants from '../constants/wallet'
import storage from '../storage'
import { useDispatch, useSelector } from 'react-redux'
import walletActions from '../state/modules/wallet/actions'
import { balanceActions } from '../state/modules/balance'
import util, { useWindowDimensions } from '../util'
import { handleAddressError } from '../handler'
import Paths from '../constants/paths'
import * as Sentry from '@sentry/browser'
import AddressInput from '../components/AddressInput'
import QrCodeScanner from '../components/QrCodeScanner'
import ScanGASteps from '../components/ScanGASteps'
import { parseOAuthOTP, parseMigrationPayload, parseAuthAccountName } from '../components/OtpTools'
import WalletCreateProgress from '../components/WalletCreateProgress'
import RestoreByCodes from './Restore/RestoreByCodes'
import SyncRecoveryFile from './Restore/SyncRecoveryFile'
import SetupNewCode from './Restore/SetupNewCode'
import LocalImport from '../components/LocalImport'
import RestoreByScan from './Restore/RestoreByScan'
import { retrieveWalletInfoFromAddress } from './Restore/Common'

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
  const [expert, setExpert] = useState()
  const [newCoreParams, setNewCoreParams] = useState()
  const [address, setAddress] = useState()

  const onSynced = async (retrievalAddress, innerTrees, expert) => {
    try {
      const { wallet } = await retrieveWalletInfoFromAddress(retrievalAddress)
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
          <Hint>You need (1) wallet recovery file (2) your authenticator codes. You will be asked to provide type 6-digit code for 6 times (30 seconds each). You need to setup a new authenticator code after that</Hint>
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
      <AnimatedSection show={section === Sections.RecoveryCode}>
        <RestoreByCodes
          isActive={section === Sections.RecoveryCode}
          onComplete={() => setSection(Sections.SetupNewCode)}
          onCancel={() => setSection(Sections.Choose)}
          newCoreParams={newCoreParams}
          wallet={walletInfo}
          innerTrees={innerTrees}
        />
      </AnimatedSection>
      <AnimatedSection show={section === Sections.SetupNewCode}>
        <SetupNewCode
          wallet={walletInfo}
          expert={expert}
          active={section === Sections.SetupNewCode}
          onComplete={() => setSection(Sections.RecoveryCode)}
          onCancel={() => setSection(Sections.Choose)}
          onProgressUpdate={({ progress, stage }) => { setProgress(progress); setProgressStage(stage) }}
          onComputedCoreParams={e => setNewCoreParams(e)}
        />
      </AnimatedSection>
    </>
  )
}
export default Restore
