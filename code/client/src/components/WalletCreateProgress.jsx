import { Hint } from './Text'
import { Progress, Space, Timeline } from 'antd'
import React from 'react'

const WalletCreateProgress = ({ progress, progressStage, isMobile, title, subtitle }) => {
  const getColor = (expected) => {
    if (progressStage === expected) {
      return 'blue'
    }
    if (progressStage < expected) {
      return 'grey'
    }
    return 'green'
  }
  return (
    <Space direction='vertical'>
      <Hint>{title || 'One moment... we are still preparing your wallet'}</Hint>
      <Space size='large' direction={isMobile && 'vertical'} style={{ marginTop: 16 }}>
        <Progress
          type='circle'
          strokeColor={{
            '0%': '#108ee9',
            '100%': '#87d068',
          }}
          percent={progress}
        />
        <Space direction='vertical'>
          <Timeline pending={progressStage < 3 && (subtitle || 'Securing your keyless 1wallet')}>
            <Timeline.Item color={getColor(0)}>Encrypting authenticator code</Timeline.Item>
            <Timeline.Item color={getColor(1)}>Securing future transactions</Timeline.Item>
            <Timeline.Item color={getColor(2)}>Making wallet recoverable</Timeline.Item>
          </Timeline>
        </Space>
      </Space>
    </Space>
  )
}

export default WalletCreateProgress
