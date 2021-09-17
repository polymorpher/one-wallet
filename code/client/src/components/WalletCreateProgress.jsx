import { Hint } from './Text'
import { Progress, Space, Timeline } from 'antd'
import React from 'react'

const WalletCreateProgress = ({ progress, progressStage, isMobile, title, subtitle }) => {
  return (
    <>
      <Hint>{title || 'One moment... we are still preparing your wallet'}</Hint>
      <Space size='large' direction={isMobile && 'vertical'}>
        <Progress
          type='circle'
          strokeColor={{
            '0%': '#108ee9',
            '100%': '#87d068',
          }}
          percent={progress}
        />
        <Space direction='vertical'>
          <Timeline pending={progressStage < 2 && (subtitle || 'Securing your keyless 1wallet')}>
            <Timeline.Item color={progressStage < 1 ? 'grey' : 'green'}>Generating proofs</Timeline.Item>
            <Timeline.Item color={progressStage < 2 ? 'grey' : 'green'}>Preparing signatures</Timeline.Item>
          </Timeline>
        </Space>
      </Space>
    </>
  )
}

export default WalletCreateProgress
