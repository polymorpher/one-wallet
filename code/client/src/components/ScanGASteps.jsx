import { Steps } from 'antd'
import React from 'react'
const { Step } = Steps

const ScanGASteps = () => (
  <Steps current={0} direction='vertical'>
    <Step title='Open Google Authenticator' description='Tap ... (top right corner) -> Export accounts' />
    <Step title='Select Your Wallet' description='Unselect all accounts. Select your wallet only' />
    <Step title='Scan the QR code' description='Point the exported QR code to your webcam' />
  </Steps>
)

export default ScanGASteps
