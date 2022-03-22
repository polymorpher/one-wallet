import Row from 'antd/es/row'
import Spin from 'antd/es/spin'
import Steps from 'antd/es/steps'
import React from 'react'
import { useWindowDimensions } from '../util'
const { Step } = Steps

export const CommitRevealProgress = ({ stage, style }) => {
  const { isMobile } = useWindowDimensions()
  return (
    <>
      {stage >= 0 && (
        <Row style={{marginTop: 32, ...style}}>
          <Steps current={stage} direction={isMobile ? 'vertical' : 'horizontal'}>
            <Step icon={stage === 0 && <Spin />} title='Prepare' description='Preparing signature' />
            <Step icon={stage === 1 && <Spin />} title='Commit' description='Locking-in operation' />
            <Step icon={stage === 2 && <Spin />} title='Finalize' description='Submitting proofs' />
          </Steps>
        </Row>)}
    </>
  )
}
