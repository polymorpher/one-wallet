import { Row, Steps } from 'antd'
import React from 'react'
const { Step } = Steps

export const CommitRevealProgress = ({ stage, style }) => {
  return (
    <>
      {stage >= 0 && (
        <Row style={style}>
          <Steps current={stage}>
            <Step title='Prepare' description='Preparing signature' />
            <Step title='Commit' description='Locking-in operation' />
            <Step title='Finalize' description='Submitting proofs' />
          </Steps>
        </Row>)}
    </>
  )
}
