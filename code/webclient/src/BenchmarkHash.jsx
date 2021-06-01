import React, { useEffect, useState } from 'react'

import styled from 'styled-components'
import Button from 'react-bootstrap/Button'
import Form from 'react-bootstrap/Form'
import Container from 'react-bootstrap/Container'
import BTRow from 'react-bootstrap/Row'

const Row = styled(BTRow)`
  margin-top: 16px;
  margin-bottom: 16px;
`

const BenchmarkPage = () => {
  const [worker, setWorker] = useState()
  const [size, setSize] = useState(100000)
  const [output, setOutput] = useState('Performance report:\n')
  const onRunBenchmark = () => {
    setOutput('Performance report:\n')
    if (worker) {
      worker.postMessage({ caller: 'ONEWallet', action: 'runBenchmark', size })
    }
  }
  useEffect(() => {
    const worker = new Worker('hashBenchmark.js')
    worker.onmessage = event => {
      const { key, time } = event.data
      setOutput(o => {
        return o + `${key}: ${time / 1000} seconds\n`
      })
    }
    setWorker(worker)
  }, [])
  return (
    <Container>
      <Row>
        <Form.Label>Number of hashes</Form.Label>
        <Form.Control type='text' value={size} onChange={(e) => setSize(parseInt(e.target.value))} />
      </Row>
      <Row>
        <Button onClick={onRunBenchmark}>Run Benchmark</Button>
      </Row>
      <Row>
        <Form.Control as='textarea' rows={10} value={output} readOnly />
      </Row>
    </Container>
  )
}

export default BenchmarkPage
