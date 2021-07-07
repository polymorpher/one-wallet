const React = require('react')
const { useState, useEffect } = React
const { render, Text, Newline, Box, useStdout, useApp } = require('ink')
const b32 = require('hi-base32')
const { Worker } = require('worker_threads')
const qrcode = require('qrcode')
const path = require('path')
// const ONE = require('../../lib/onewallet')
const ONENames = require('../../lib/names')
const ONEUtil = require('../../lib/util')
const crypto = require('crypto')
const Gradient = require('ink-gradient')
const BigText = require('ink-big-text')
const config = require('../config')
const Constants = require('../constants')
const store = require('./store')
// const why = require('why-is-node-running')
const PROGRESS_REPORT_INTERVAL = 1

const getQRCodeUri = ({ name, seed }) => {
  // otpauth://TYPE/LABEL?PARAMETERS
  name = name.replace(' ', '%20')
  return `otpauth://totp/${name}?secret=${b32.encode(seed)}&issuer=Harmony`
}

const NewWallet = ({ network }) => {
  const { exit } = useApp()
  // eslint-disable-next-line no-unused-vars
  const { write: log } = useStdout()
  // eslint-disable-next-line no-unused-vars
  const [duration, setDuration] = useState(Constants.defaultDuration)
  const [seed] = useState(new Uint8Array(crypto.randomBytes(20).buffer))
  const [name] = useState(ONENames.randomWord(3, '-'))
  const [data, setData] = useState()

  const [progress, setProgress] = useState(0)
  const [progressStage, setProgressStage] = useState(-1)
  const [worker, setWorker] = useState()
  // eslint-disable-next-line no-unused-vars
  const [slotSize, setSlotSize] = useState(1)
  const [effectiveTime, setEffectiveTime] = useState()

  useEffect(() => {
    const uri = getQRCodeUri({ name, seed })
    const code = qrcode.create(uri, { errorCorrectionLevel: 'low' })
    setData(code.modules)
  }, [])

  useEffect(() => {
    const worker = new Worker(path.join(__dirname, 'ONEWalletWorker.js'))
    worker.on('message', async ({ status, current, total, stage, result } = {}) => {
      if (status === 'working') {
        // log(`Completed ${(current / total * 100).toFixed(2)}%`)
        if (current % PROGRESS_REPORT_INTERVAL === 0) {
          setProgress(Math.round(current / total * 100))
        }

        setProgressStage(stage)
      }
      if (status === 'done') {
        const { hseed, root, layers, maxOperationsPerInterval: slotSize } = result
        const state = {
          name,
          root: ONEUtil.hexView(root),
          duration,
          effectiveTime,
          slotSize,
          hseed: ONEUtil.hexView(hseed),
          network
        }
        await store.storeIncompleteWallet({ state, layers })
        worker.terminate()
        process.exit(0)
        // why()
        // log('Received created wallet from worker', result)
      }
    })
    setWorker(worker)
  }, [])

  useEffect(() => {
    if (worker) {
      // log('posting to worker')
      const t = Math.floor(Date.now() / Constants.interval) * Constants.interval
      setEffectiveTime(t)
      worker && worker.postMessage({
        seed, effectiveTime: t, duration, slotSize, interval: Constants.interval
      })
    }
  }, [worker])

  if (!data) {
    return <></>
  }

  const rows = []
  for (let i = 0; i < data.size; i += 1) {
    const buffer = []
    for (let j = 0; j < data.size; j += 1) {
      if (data.get(i, j)) {
        buffer.push(<Text backgroundColor='#000000' key={`${i}-${j}`}>{'\u3000'}</Text>)
      } else {
        buffer.push(<Text backgroundColor='#ffffff' key={`${i}-${j}`}>{'\u3000'}</Text>)
      }
    }
    rows.push(<Text key={`r-${i}`}><Text>{buffer}</Text><Newline /></Text>)
  }
  return (
    <>
      <Box marginBottom={2}>
        <Gradient colors={['#30c5dc', '#01e6a3']}>
          <BigText text='ONE Wallet' />
          <Text>CLI version {config.version}</Text>
        </Gradient>
      </Box>
      <Box marginBottom={2} flexDirection='column'>
        <Text>Please scan the QR code using your Google Authenticator.</Text>
        <Text>You need the 6-digit code from Google authenticator to transfer funds. You can restore your wallet using Google authenticator on any device.</Text>
      </Box>
      <Text>{rows}</Text>
      <Box marginY={2} flexDirection='column'>
        <Text>After you are done, use</Text>
        <Box borderStyle='single'><Text>1wallet make {'<recovery-address> <code>'}</Text></Box>
        <Text>command to deploy the wallet. If you need help, try</Text>
        <Box borderStyle='single'><Text>1wallet help</Text></Box>
      </Box>
      <Box marginBottom={2} flexDirection='column'>
        <Text>Building wallet...</Text>
        <Text color={progressStage === 0 ? 'yellow' : (progressStage < 0 ? 'grey' : 'green')}>Securing the wallet {progressStage === 0 && `${progress}%`}</Text>
        <Text color={progressStage === 1 ? 'yellow' : (progressStage < 1 ? 'grey' : 'green')}>Preparing signatures {progressStage === 1 && `${progress}%`}</Text>
        <Text color={progressStage < 2 ? 'grey' : 'green'}>Done!</Text>
      </Box>

    </>
  )
}

module.exports = () => render(<NewWallet />)
