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
  const [includeIO, setIncludeIO] = useState(true)
  const [parallelFastSHA256, setParallelFastSHA256] = useState(true)
  const [fastSHA256, setFastSHA256] = useState(true)
  const [ethersSha256, setEthersSha256] = useState(true)
  const [ripemd160, setRipemd160] = useState(true)
  const [ethersKeccak256, setEthersKeccak256] = useState(true)
  const [soliditySha3, setSoliditySha3] = useState(true)
  const [keccak, setKeccak] = useState(false)
  const [SHA3Keccak, setSHA3Keccak] = useState(false)

  const [output, setOutput] = useState('Performance report:\n')
  const onRunBenchmark = () => {
    setOutput('Performance report:\n')
    if (worker) {
      worker.postMessage({ caller: 'ONEWallet',
        action: 'runBenchmark',
        size,
        includeIO,
        enabled: {
          parallelFastSHA256,
          fastSHA256,
          ethersSha256,
          ripemd160,
          ethersKeccak256,
          soliditySha3,
          keccak,
          SHA3Keccak
        }
      })
    }
  }
  useEffect(() => {
    const worker = new Worker('hashBenchmark.js')
    worker.onmessage = event => {
      const { key, time } = event.data
      setOutput(o => {
        return o + (time ? `${key}: ${time / 1000} seconds\n` : `${key} \n`)
      })
    }
    setWorker(worker)
  }, [])
  // const [parallelFastSHA256, setParallelFastSHA256] = useState(true)
  // const [fastSHA256, setFastSHA256] = useState(true)
  // const [ethersSha256, setEthersSha256] = useState(true)
  // const [ripemd160, setRipemd160] = useState(true)
  // const [ethersKeccak256, setEthersKeccak256] = useState(true)
  // const [soliditySha3, setSoliditySha3] = useState(true)
  // const [keccak, setKeccak] = useState(true)
  // const [SHA3Keccak, setSHA3Keccak] = useState(true)
  return (
    <Container>
      <Row>
        <Form.Label>Number of hashes</Form.Label>
        <Form.Control type='text' value={size} onChange={(e) => setSize(parseInt(e.target.value))} />
      </Row>
      <Form.Row>
        <Form.Group>
          <Form.Check type='checkbox' label='Include I/O' checked={includeIO} onChange={e => setIncludeIO(e.target.checked)} />
          <Form.Check type='checkbox' label='parallelFastSHA256' checked={parallelFastSHA256} onChange={e => setParallelFastSHA256(e.target.checked)} />
          <Form.Check type='checkbox' label='fastSHA256' checked={fastSHA256} onChange={e => setFastSHA256(e.target.checked)} />
          <Form.Check type='checkbox' label='ethersSha256' checked={ethersSha256} onChange={e => setEthersSha256(e.target.checked)} />
          <Form.Check type='checkbox' label='ripemd160' checked={ripemd160} onChange={e => setRipemd160(e.target.checked)} />
          <Form.Check type='checkbox' label='ethersKeccak256' checked={ethersKeccak256} onChange={e => setEthersKeccak256(e.target.checked)} />
          <Form.Check type='checkbox' label='soliditySha3 (slow)' checked={soliditySha3} onChange={e => setSoliditySha3(e.target.checked)} />
          <Form.Check type='checkbox' label='keccak (quite slow)' checked={keccak} onChange={e => setKeccak(e.target.checked)} />
          <Form.Check type='checkbox' label='SHA3Keccak (very slow!)' checked={SHA3Keccak} onChange={e => setSHA3Keccak(e.target.checked)} />
        </Form.Group>
      </Form.Row>
      <Row>
        <Button onClick={onRunBenchmark}>Run Benchmark</Button>
      </Row>
      <Row>
        <Form.Control as='textarea' rows={20} value={output} readOnly />
      </Row>
    </Container>
  )
}

export default BenchmarkPage
