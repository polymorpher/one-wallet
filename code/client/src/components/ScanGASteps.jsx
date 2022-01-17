import Steps from 'antd/es/steps'
import React from 'react'
const { Step } = Steps

const ScanGASteps = () => (
  <Steps direction='vertical'>
    <Step status='process' title='Open Google Authenticator' description='Tap ... (top right corner) -> Export accounts' />
    <Step status='process' title='Select Your Wallet' description='Unselect all accounts. Select your wallet only' />
    <Step status='process' title='Scan the QR code' description='Point the exported QR code to your webcam' />
  </Steps>
)

export default ScanGASteps
