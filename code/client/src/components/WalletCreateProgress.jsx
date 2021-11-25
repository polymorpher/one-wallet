import { Hint } from './Text'
import { Progress, Space, Timeline } from 'antd'
import React from 'react'

const WalletCreateProgress = ({ progress, progressStage, isMobile, title, subtitle }) => {
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
            <Timeline.Item color={progressStage < 1 ? 'grey' : 'green'}>Encrypting codes</Timeline.Item>
            <Timeline.Item color={progressStage < 2 ? 'grey' : 'green'}>Preparing recovery</Timeline.Item>
            <Timeline.Item color={progressStage < 3 ? 'grey' : 'green'}>Creating signatures</Timeline.Item>
          </Timeline>
        </Space>
      </Space>
    </Space>
  )
}

export default WalletCreateProgress
