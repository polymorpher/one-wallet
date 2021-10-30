import { Steps } from 'antd'
import React from 'react'
const { Step } = Steps

const ScanGASteps = () => (
  <Steps current={0} direction='vertical'>
    <Step title='Open Google Authenticator' description='Go to Google Authenticator, tap ... -> Export accounts on the top right corner' />
    <Step title='Select Your Wallet' description='Make sure your wallet is selected. Unselect other accounts.' />
    <Step title='Scan the QR code' description='Scan the exported QR code on your Google Authenticator app' />
  </Steps>
)

export default ScanGASteps
