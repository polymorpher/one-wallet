import React, { useState, useEffect } from 'react'
import crypto from 'crypto'
import b32 from 'thirty-two'
import * as truffleClient from './truffleClient'
import ProgressBar from '@ramonak/react-progress-bar'
// const twofactor = require('node-2fa')

const createOTPSeed = ({ otpInterval }) => {
  // const newSecret = twofactor.generateSecret({ name: 'My Awesome App', account: 'johndoe' })
  const config = {
    name: encodeURIComponent('ONE Wallet'),
    account: encodeURIComponent('User'),
    step: encodeURIComponent(otpInterval),
  }
  const bin = crypto.randomBytes(20)
  const base32 = b32.encode(bin).toString('utf8').replace(/=/g, '')

  const seed = base32
    .toLowerCase()
    .replace(/(\w{4})/g, '$1 ')
    .trim()
    .split(' ')
    .join('')
    .toUpperCase()

  const query = `?secret=${seed}&issuer=${config.name}`
  const encodedQuery = query.replace('?', '%3F').replace('&', '%26')
  const uri = `otpauth://totp/${config.name}${config.account}`
  const qrCodeUrl = `https://chart.googleapis.com/chart?chs=166x166&chld=L|0&cht=qr&chl=${uri}${encodedQuery}`

  return {
    seed,
    uri,
    qrCodeUrl
  }
}

const CreateWallet = ({ onCreated, onClose }) => {
  const [worker, setWorker] = useState()
  const [otpInterval, setOtpInterval] = useState(30) // seconds
  const [otpMerkleTreeDepth, setTreeDepth] = useState(16)
  const [walletEffectiveTime, setWalletEffectiveTime] = useState(0) // seconds
  const [walletExpirationTime, setWalletExpirationTime] = useState(0) // seconds
  const [drainAddress, setDrainAddress] = useState('')
  const [isCreationInProgress, setIsCreationInProgress] = useState(false)
  const [isGeneratingLeaves, setIsGeneratingLeaves] = useState(false)
  const [rootHash, setRootHash] = useState('') // wallet
  const [otpLeaves, setOtpLeaves] = useState([])
  const [generationProgress, setGenerationProgress] = useState(0)
  const [authenticatorConfig, setAuthenticatorConfig] = useState({ seed: '', uri: '', qrCodeUrl: '' })

  useEffect(() => {
    const secondsNow = Math.floor((Date.now() / 1000))
    setWalletEffectiveTime(secondsNow - (secondsNow % 30))
    setDrainAddress(window.App.defaultAccount || '')
    const worker = new Worker('oneWalletWorker.js')
    worker.onmessage = (event) => {
      const { status, current, total, wallet } = event.data
      if (status === 'working') {
        console.log(`Completed ${(current / total * 100).toFixed(2)}%`)
        setGenerationProgress(Math.floor(current / total * 100))
      }
      if (status === 'done') {
        setWalletExpirationTime(walletEffectiveTime + (Math.pow(2, otpMerkleTreeDepth) * otpInterval))
        setRootHash(wallet.root)
        setOtpLeaves(wallet.leafs)
        setIsCreationInProgress(false)
        console.log('Received created wallet from worker:', wallet)
      }
    }
    setWorker(worker)
  }, [])
  useEffect(() => {
    if (authenticatorConfig.seed) {
      console.log('posting to worker')
      setIsGeneratingLeaves(true)
      setGenerationProgress(0)
      // TODO: fix worker parameter names
      worker && worker.postMessage({
        otpSeed: authenticatorConfig.seed,
        merkleTreeDepth: otpMerkleTreeDepth,
        otpInterval: otpInterval,
        effectiveTime: walletEffectiveTime
      })
    }
  }, [authenticatorConfig, otpInterval, otpMerkleTreeDepth])
  const onCreateNewOTPSeed = (e) => {
    e.preventDefault()
    const { seed, uri, qrCodeUrl } = createOTPSeed(otpInterval)
    setAuthenticatorConfig({ seed, uri, qrCodeUrl })
    return false
  }
  const onCreateWallet = async () => {
    setIsCreationInProgress(true)
    const w = await truffleClient.createWallet(
      rootHash,
      otpMerkleTreeDepth,
      otpInterval,
      walletEffectiveTime,
      otpLeaves,
      drainAddress
    )
    console.log('[onCreateWallet] Created wallet', w)
    onCreated && onCreated(w)
  }
  // TODO: break it down by parts
  return (
    <div className='card bg-light mb-3 mt-3'>
      <div className='card-header'>Create a wallet
        <button
          className='pull-right clickable close-icon' data-effect='fadeOut'
          onClick={(e) => {
            onClose && onClose()
          }}
        ><i className='fa fa-times' />
        </button>
      </div>
      <div className='card-body'>
        <form>
          <div className='form-group row'>
            <label className='col-sm-4 col-form-label'>TOTP Secret</label>
            <div className='col-sm-8'>
              {authenticatorConfig.seed &&
                <div className='mb-4'>
                  <img src={authenticatorConfig.qrCodeUrl} alt='' /><br />
                  {authenticatorConfig.seed}<br />
                Scan with your Google Authenticator
                </div>}
              <button
                className='btn btn-primary btn-sm'
                style={{ marginBottom: 16 }}
                onClick={onCreateNewOTPSeed}
              >Generate new secret
              </button>
              {isGeneratingLeaves &&
                <ProgressBar
                  completed={generationProgress}
                  transitionDuration='0s'
                  transitionTimingFunction='linear'
                />}
            </div>
          </div>
          <div className='form-group row'>
            <label className='col-sm-4 col-form-label'>Merkle Hash</label>
            <div className='col-sm-8'>
              <input
                type='text' readOnly className='form-control'
                value={rootHash}
              />
            </div>
          </div>
          <div className='form-group row'>
            <label className='col-sm-4 col-form-label'>Duration</label>
            <div className='col-sm-8'>
              <input
                type='number' className='form-control' value={otpInterval}
                onChange={(e) => setOtpInterval(parseInt(e.target.value))}
              />
            </div>
          </div>
          <div className='form-group row'>
            <label className='col-sm-4 col-form-label'>Tree Depth</label>
            <div className='input-group col-sm-8'>
              <input
                type='number' className='form-control' value={otpMerkleTreeDepth}
                onChange={(e) => setTreeDepth(parseInt(e.target.value))}
              />
              <div className='input-group-append'>
                <span className='input-group-text' id='basic-addon2'>{Math.pow(2, otpMerkleTreeDepth)} leaves</span>
              </div>
            </div>
          </div>
          <div className='form-group row'>
            <label className='col-sm-4 col-form-label'>Effective Time</label>
            <div className='input-group col-sm-8'>
              <input
                type='text' className='form-control' value={walletEffectiveTime}
                onChange={(e) => setWalletEffectiveTime(parseInt(e.target.value))}
              />
              <div className='input-group-append'>
                <span className='input-group-text'>
                  {new Date(walletEffectiveTime * 1000).toISOString()}
                </span>
              </div>
            </div>
          </div>
          <div className='form-group row'>
            <label className='col-sm-4 col-form-label'>Expiration Time</label>
            <div className='input-group col-sm-8'>
              <input type='text' readOnly className='form-control' value={walletExpirationTime} />
              <div className='input-group-append'>
                <span className='input-group-text'>{new Date(walletExpirationTime * 1000).toISOString()}
                </span>
              </div>
            </div>
          </div>
          <div className='form-group row'>
            <label className='col-sm-4 col-form-label'>Drain Address</label>
            <div className='input-group col-sm-8'>
              <input
                type='text' className='form-control' value={drainAddress}
                onChange={(e) => setDrainAddress(e.target.value)} placeholder='0x...'
              />
            </div>
          </div>
          <div className='form-group row mt-4'>
            <label className='col-sm-4 col-form-label' />
            <div className='col-sm-8'>
              {!isCreationInProgress &&
                <button
                  className='btn btn-primary' disabled={!authenticatorConfig.seed}
                  onClick={onCreateWallet}
                >
                Create Contract
                </button>}
              {isCreationInProgress && <button className='btn btn-primary' disabled>Submitting..(wait)</button>}
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
export default CreateWallet
