import React from 'react'
import { Heading, Hint } from '../components/Text'
import AnimatedSection from '../components/AnimatedSection'
import { Space, Typography, Steps } from 'antd'
const { Text } = Typography
const { Step } = Steps
const Restore = () => {
  return (
    <AnimatedSection show>
      <Space direction='vertical' size={'large'}>
        <Heading>Restore your wallet from Google Authenticator</Heading>
        <Steps direction='vertical'>
          <Step title='Open Google Authenticator' description={'Go to Google Authenticator, tap ... on top right corner, and tap "Export accounts"'} />
          <Step title='Select Your Wallet' description='Make sure your wallet is selected. Unselect other accounts which you do not want to export' />
          <Step title='Scan the QR code' description='Click the button below to use the camera on your computer to scan the QR code shown on Google Authenticator export screen' />
        </Steps>
        <Text>We are still working on this. Please check again on 6/21/2021.</Text>
      </Space>
    </AnimatedSection>
  )
}
export default Restore
