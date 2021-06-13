import React, { Component } from 'react'
import * as truffleClient from './truffleClient'
import crypto from 'crypto'
import b32 from 'thirty-two'
const wallet = require('../../lib/wallet')
const twofactor = require('node-2fa')

// props <ShowWallet address="0x..."/>
class ShowWallet extends Component {
  constructor (props) {
    super(props)
    var time = Math.floor((Date.now() / 1000))
    var timeOffset = time - (time % 300)
    this.state = { wallet: {}, submitting: false, duration: 30, timeOffset: timeOffset, depth: 10, expires: 0 }
  }
  componentDidMount () {
    var self = this
    this.leafs = JSON.parse(localStorage.getItem('wallet:' + this.props.wallet)).leafs
    truffleClient.loadWallet(this.props.wallet).then(e => {
      console.log('wallet', e)
      self.setState({ wallet: e })
    })
  }

  totpChanged (e) {
    this.setState({ withdraw_totp: e.target.value })
    var self = this
    clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      var proofs = wallet.getProofWithOTP(parseInt(e.target.value), this.leafs, this.state.wallet.timeOffset, this.state.wallet.timePeriod)
      console.log(proofs)
      if (proofs[0].includes(undefined)) {
        console.log('Expired wallet; drain your account with your drain address then create new wallet OR recover your wallet with guardians')
        self.setState({ err: 'Wallet expired - no more tokens; drain your account  and create new wallet OR recover your wallet with guardians' })
      }
      this.setState({ withdraw_totp: e.target.value, withdraw_proof: proofs[0], withdraw_sides: proofs[1] })
    }, 1000)
  }

  submit (e) {
    this.setState({ submitting: true })

    var amount = web3.utils.toWei(this.state.withdraw_amount, 'ether')
    console.log(amount, this.state.withdraw_proof, this.state.withdraw_sides)
    var self = this
    this.state.wallet.contract.makeTransfer(this.state.withdraw_to, amount, this.state.withdraw_proof, this.state.withdraw_sides).then(e => {
      console.log('submitted:', e)
      self.setState({ success: e, submitting: false })
    }).catch(ex => {
      console.log(ex)
      self.setState({ err: ex.message, submitting: false })
    })
    e.preventDefault()
  }
  addGuardian (e) {
    var self = this
    this.state.wallet.contract.addGuardian(this.state.guardian_new, this.state.withdraw_proof, this.state.withdraw_sides).then(e => {
      console.log('submitted:', e)
      self.setState({ success: e, submitting: false })
    }).catch(ex => {
      console.log(ex)
      self.setState({ err: ex.message, submitting: false })
    })
    e.preventDefault()
  }

  removeGuardian (e) {
    var self = this
    this.state.wallet.contract.revokeGuardian(this.state.guardian_new, this.state.withdraw_proof, this.state.withdraw_sides).then(e => {
      console.log('submitted:', e)
      self.setState({ success: e, submitting: false })
    }).catch(ex => {
      console.log(ex)
      self.setState({ err: ex.message, submitting: false })
    })
    e.preventDefault()
  }

  makeSecret () {
    const newSecret = twofactor.generateSecret({ name: 'My Awesome App', account: 'johndoe' })
    const config = {
      name: encodeURIComponent('SmartWallet'),
      account: encodeURIComponent('User'),
      step: encodeURIComponent(this.state.duration),
    }

    const bin = crypto.randomBytes(20)
    const base32 = b32.encode(bin).toString('utf8').replace(/=/g, '')

    const secret = base32
      .toLowerCase()
      .replace(/(\w{4})/g, '$1 ')
      .trim()
      .split(' ')
      .join('')
      .toUpperCase()

    const query = `?secret=${secret}&issuer=${config.name}`
    const encodedQuery = query.replace('?', '%3F').replace('&', '%26')
    const uri = `otpauth://totp/${config.name}${config.account}`
    const qr_fixed = `https://chart.googleapis.com/chart?chs=166x166&chld=L|0&cht=qr&chl=${uri}${encodedQuery}`

    // var time = Math.floor((Date.now() / 1000));
    // var timeOffset = time - (time% 300);

    this.setState({
      secret: secret,
      uri: uri,
      qr_fixed: qr_fixed,
    }, this.update)
  }

  generateSecret (e) {
    e.preventDefault()
    this.makeSecret()
  }

  changeDuration (e) {
    this.setState({ duration: parseInt(e.target.value) }, this.update)
  }
  changeDepth (e) {
    this.setState({ depth: parseInt(e.target.value) }, this.update)
  }

  signRecover (e) {
    var self = this
    wallet.signRecoveryOffchain([window.App.defaultAccount], this.state.rootHash,
      this.state.depth, this.state.duration, this.state.timeOffset)
      .then(sigs => {
        self.setState({ signatures: sigs })
      })
    e.preventDefault()
  }

  startRecovery (e) {
    e.preventDefault()
    var self = this
    this.state.wallet.contract.startRecovery(this.state.rootHash, this.state.depth, this.state.duration,
      this.state.timeOffset, this.state.signatures).then(e => {
      console.log('submitted:', e)
      self.setState({ success: e, submitting: false })
    })
      .catch(ex => {
        console.log(ex)
        self.setState({ err: ex.message, submitting: false })
      })
  }

  cancelRecovery (e) {
    e.preventDefault()
    var self = this
    this.state.wallet.contract.cancelRecovery(this.state.withdraw_proof, this.state.withdraw_sides).then(e => {
      console.log('submitted:', e)
      self.setState({ success: e, submitting: false })
    }).catch(ex => {
      console.log(ex)
      self.setState({ err: ex.message, submitting: false })
    })
  }

  finalizeRecovery (e) {
    e.preventDefault()
    var self = this
    this.state.wallet.contract.finalizeRecovery().then(e => {
      console.log('submitted:', e)
      self.setState({ success: e, submitting: false })
    }).catch(ex => {
      console.log(ex)
      self.setState({ err: ex.message, submitting: false })
    })
  }
  drainByTOTP (e) {
    e.preventDefault()
    var self = this
    this.state.wallet.contract.drain(this.state.withdraw_proof, this.state.withdraw_sides).then(e => {
      console.log('submitted:', e)
      self.setState({ success: e, submitting: false })
    }).catch(ex => {
      console.log(ex)
      self.setState({ err: ex.message, submitting: false })
    })
  }

  drain (e) {
    e.preventDefault()
    var self = this
    this.state.wallet.contract.drain().then(e => {
      console.log('submitted:', e)
      self.setState({ success: e, submitting: false })
    }).catch(ex => {
      console.log(ex)
      self.setState({ err: ex.message, submitting: false })
    })
  }

  update () {
    var mywallet = wallet.generateWallet(this.state.secret, this.state.depth, this.state.duration, this.state.timeOffset)
    var expires = this.state.timeOffset + (Math.pow(2, this.state.depth) * this.state.duration)
    this.setState({
      rootHash: mywallet.root,
      leafs: mywallet.leafs,
      expires: expires
    })
  }

  render () {
    return (
      <div className='card bg-light mb-3 mt-3'>
        <div className='card-header'>Wallet: {this.props.wallet}
        </div>
        <div className='card-body'>
          <table className='table table-bordered'>
            <tbody>
              <tr>
                <th scope='row'>Smart Contract Address</th>
                <td>{this.props.wallet}</td>
              </tr>
              <tr>
                <th scope='row'>Merkel Hash</th>
                <td>{this.state.wallet.rootHash}</td>
              </tr>
              <tr>
                <th scope='row'>Tree Height</th>
                <td>{this.state.wallet.height && this.state.wallet.height.toString()}</td>
              </tr>
              <tr>
                <th scope='row'>Time Period</th>
                <td>{this.state.wallet.timePeriod && this.state.wallet.timePeriod.toString()}</td>
              </tr>
              <tr>
                <th scope='row'>Time Offset</th>
                <td>{this.state.wallet.timeOffset && this.state.wallet.timeOffset.toString()}</td>
              </tr>
              <tr>
                <th scope='row'>Daily Limit</th>
                <td>{this.state.wallet.dailyLimit && web3.utils.fromWei(this.state.wallet.dailyLimit).toString()}</td>
              </tr>
              <tr>
                <th scope='row'>Guardians</th>
                <td>{this.state.wallet.guardians && this.state.wallet.guardians.join(' ')}</td>
              </tr>
              <tr>
                <th scope='row'>Balance</th>
                <td>{this.state.wallet.balance && web3.utils.fromWei(this.state.wallet.balance).toString()}</td>
              </tr>
              <tr>
                <th scope='row'>Recovery Started</th>
                <td>{this.state.wallet.isRecovering ? 'YES' : 'NO'}</td>
              </tr>
            </tbody>
          </table>

          <nav>
            <div className='nav nav-tabs' id='nav-tab' role='tablist'>
              <a className='nav-item nav-link active' id='nav-home-tab' data-toggle='tab' href='#nav-home' role='tab' aria-controls='nav-home' aria-selected='true'>Withdraw</a>
              <a className='nav-item nav-link' id='nav-profile-tab' data-toggle='tab' href='#nav-profile' role='tab' aria-controls='nav-profile' aria-selected='false'>Guardian</a>
              <a className='nav-item nav-link' id='nav-contact-tab' data-toggle='tab' href='#nav-contact' role='tab' aria-controls='nav-contact' aria-selected='false'>Recovery</a>
              <a className='nav-item nav-link' id='nav-drain-tab' data-toggle='tab' href='#nav-drain' role='tab' aria-controls='nav-drain' aria-selected='false'>Drain</a>
            </div>
          </nav>
          <div className='tab-content p-3' id='nav-tabContent'>
            <div className='tab-pane fade show active' id='nav-home' role='tabpanel' aria-labelledby='nav-home-tab'>
              <form>
                <div className='form-group row'>
                  <label htmlFor='inputEmail3' className='col-sm-4 col-form-label'>Destination Address</label>
                  <div className='col-sm-8'>
                    <input type='text' className='form-control' id='inputEmail3' value={this.state.withdraw_to} onChange={(e) => this.setState({ withdraw_to: e.target.value })} />
                  </div>
                </div>
                <div className='form-group row'>
                  <label htmlFor='inputEmail3' className='col-sm-4 col-form-label'>Amount (ETH)</label>
                  <div className='col-sm-8'>
                    <input type='number' className='form-control' id='inputEmail3' value={this.state.withdraw_amount} onChange={(e) => this.setState({ withdraw_amount: e.target.value })} />
                  </div>
                </div>
                <div className='form-group row'>
                  <label htmlFor='inputEmail3' className='col-sm-4 col-form-label'>TOTP Code</label>
                  <div className='col-sm-8'>
                    <input type='number' className='form-control' id='inputEmail3' value={this.state.withdraw_totp} onChange={this.totpChanged.bind(this)} />
                  </div>
                </div>
                <div className='form-group row'>
                  <label htmlFor='inputEmail3' className='col-sm-4 col-form-label'>Proof</label>
                  <div className='col-sm-8'>
                    <textarea readOnly className='form-control' value={this.state.withdraw_proof} />
                  </div>
                </div>
                <div className='form-group row'>
                  <label htmlFor='inputEmail3' className='col-sm-4 col-form-label'>Sides</label>
                  <div className='col-sm-8'>
                    <input readOnly type='text' className='form-control' id='inputEmail3' value={this.state.withdraw_sides} />
                  </div>
                </div>
                <div className='form-group row mt-4'>
                  <label htmlFor='inputEmail3' className='col-sm-4 col-form-label' />
                  <div className='col-sm-8'>
                    {!this.state.submitting && <button className='btn btn-primary' onClick={this.submit.bind(this)}>Submit Transaction</button>}
                    {this.state.submitting && <button className='btn btn-primary' disabled>Submitting..(wait)</button>}
                  </div>

                  {this.state.success &&
                    <div className='mt-4 alert alert-primary' role='alert'>
                                        Success: Transaction hash: <a target='_NEW' href={'https://rinkeby.etherscan.io/tx/' + this.state.success.tx}>{this.state.success.tx}</a>
                    </div>}
                  {this.state.err &&
                    <div className='mt-4 alert alert-danger' role='alert'>
                                        Error: {this.state.err} <a target='_NEW' href={'https://rinkeby.etherscan.io/address/' + this.props.wallet}>{this.props.wallet}</a>
                    </div>}
                </div>
              </form>
            </div>
            <div className='tab-pane fade' id='nav-profile' role='tabpanel' aria-labelledby='nav-profile-tab'>
              <form>
                <div className='form-group row'>
                  <label htmlFor='inputEmail3' className='col-sm-4 col-form-label'>Guardian Address</label>
                  <div className='col-sm-8'>
                    <input type='text' className='form-control' id='inputEmail3' value={this.state.guardian_new} onChange={(e) => this.setState({ guardian_new: e.target.value })} />
                  </div>
                </div>
                <div className='form-group row'>
                  <label htmlFor='inputEmail3' className='col-sm-4 col-form-label'>TOTP Code</label>
                  <div className='col-sm-8'>
                    <input type='number' className='form-control' id='inputEmail3' value={this.state.withdraw_totp} onChange={this.totpChanged.bind(this)} />
                  </div>
                </div>
                <div className='form-group row'>
                  <label htmlFor='inputEmail3' className='col-sm-4 col-form-label' />
                  <div className='col-sm-8'>
                    {!this.state.submitting && <button className='btn btn-primary' onClick={this.addGuardian.bind(this)}>Add Guardian</button>}
                    {this.state.submitting && <button className='btn btn-primary' disabled>Submitting..(wait)</button>}
                    {!this.state.submitting && <button className='btn btn-primary ml-3' onClick={this.removeGuardian.bind(this)}>Remove Guardian</button>}
                  </div>
                </div>
              </form>

            </div>
            <div className='tab-pane fade' id='nav-contact' role='tabpanel' aria-labelledby='nav-contact-tab'>
              <form>
                <div className='form-group row'>
                  <label htmlFor='inputEmail3' className='col-sm-4 col-form-label'>TOTP Secret</label>
                  <div className='col-sm-8'>
                    {this.state.secret &&
                      <div className='mb-4'>
                        <img src={this.state.qr_fixed} /><br />
                        {this.state.secret}<br />
                                            Scan with your Google Authenticator
                      </div>}
                    <a className='btn btn-primary btn-sm' onClick={this.generateSecret.bind(this)}>Generate new secret</a>
                  </div>
                </div>
                <div className='form-group row'>
                  <label htmlFor='inputEmail3' className='col-sm-4 col-form-label'>Merkle Hash</label>
                  <div className='col-sm-8'>
                    <input type='text' readOnly className='form-control' id='inputEmail3' value={this.state.rootHash} />
                  </div>
                </div>
                <div className='form-group row'>
                  <label htmlFor='inputEmail3' className='col-sm-4 col-form-label'>Duration</label>
                  <div className='col-sm-8'>
                    <input type='number' className='form-control' id='inputEmail3' value={this.state.duration} onChange={this.changeDuration.bind(this)} />
                  </div>
                </div>
                <div className='form-group row'>
                  <label htmlFor='inputEmail3' className='col-sm-4 col-form-label'>Tree Depth</label>
                  <div className='input-group col-sm-8'>
                    <input type='number' className='form-control' value={this.state.depth} onChange={this.changeDepth.bind(this)} placeholder="Recipient's username" aria-label="Recipient's username" aria-describedby='basic-addon2' />
                    <div className='input-group-append'>
                      <span className='input-group-text' id='basic-addon2'>{Math.pow(2, this.state.depth)} leafs</span>
                    </div>
                  </div>
                </div>
                <div className='form-group row'>
                  <label htmlFor='inputEmail3' className='col-sm-4 col-form-label'>Time Offset</label>
                  <div className='input-group col-sm-8'>
                    <input type='text' className='form-control' value={this.state.timeOffset} placeholder="Recipient's username" aria-label="Recipient's username" aria-describedby='basic-addon2' />
                    <div className='input-group-append'>
                      <span className='input-group-text' id='basic-addon2'>{new Date(this.state.timeOffset * 1000).toISOString()}</span>
                    </div>
                  </div>
                </div>
                <div className='form-group row'>
                  <label htmlFor='inputEmail3' className='col-sm-4 col-form-label'>Expires</label>
                  <div className='input-group col-sm-8'>
                    <input type='text' readOnly className='form-control' value={this.state.expires} placeholder="Recipient's username" aria-label="Recipient's username" aria-describedby='basic-addon2' />
                    <div className='input-group-append'>
                      <span className='input-group-text' id='basic-addon2'>{new Date(this.state.expires * 1000).toISOString()}</span>
                    </div>
                  </div>
                </div>
                <div className='form-group row'>
                  <label htmlFor='inputEmail3' className='col-sm-4 col-form-label'>Signatures</label>
                  <div className='col-sm-8'>
                    <textarea className='form-control' value={this.state.signatures} />
                  </div>
                </div>
                <div className='form-group row mt-4'>
                  <label htmlFor='inputEmail3' className='col-sm-4 col-form-label' />
                  <div className='col-sm-8'>
                    {!this.state.creating && <button className='btn btn-info' disabled={!this.state.secret} onClick={this.signRecover.bind(this)}>Sign Message</button>}
                    {this.state.creating && <button className='btn btn-primary' disabled>Submitting..(wait)</button>}
                    {!this.state.creating && <button className='btn btn-primary ml-3' disabled={!this.state.secret} onClick={this.startRecovery.bind(this)}>Submit Transaction</button>}
                  </div>
                </div>
              </form>
              <hr />
              <form>
                <div className='form-group row'>
                  <label htmlFor='inputEmail3' className='col-sm-4 col-form-label'>TOTP Code</label>
                  <div className='col-sm-8'>
                    <input type='number' className='form-control' id='inputEmail3' value={this.state.withdraw_totp} onChange={this.totpChanged.bind(this)} />
                  </div>
                </div>
                <div className='form-group row'>
                  <label htmlFor='inputEmail3' className='col-sm-4 col-form-label' />
                  <div className='col-sm-8'>
                    {!this.state.submitting && <button className='btn btn-primary' onClick={this.cancelRecovery.bind(this)}>Cancel Recovery</button>}
                    {this.state.submitting && <button className='btn btn-primary' disabled>Submitting..(wait)</button>}
                  </div>
                </div>
              </form>
              <hr />
              <div className='form-group row'>
                <label htmlFor='inputEmail3' className='col-sm-4 col-form-label'>After period of 24hrs, anyone can submit to finalize recovery.</label>
                <div className='col-sm-8'>
                  {!this.state.submitting && <button className='btn btn-primary' onClick={this.finalizeRecovery.bind(this)}>Finalize Recovery</button>}
                  {this.state.submitting && <button className='btn btn-primary' disabled>Submitting..(wait)</button>}
                </div>
              </div>
              {this.state.success &&
                <div className='mt-4 alert alert-primary' role='alert'>
                                Success: Transaction hash: <a target='_NEW' href={'https://rinkeby.etherscan.io/tx/' + this.state.success.tx}>{this.state.success.tx}</a>
                </div>}
              {this.state.err &&
                <div className='mt-4 alert alert-danger' role='alert'>
                                Error: {this.state.err} <a target='_NEW' href={'https://rinkeby.etherscan.io/address/' + this.props.wallet}>{this.props.wallet}</a>
                </div>}
            </div>
            <div className='tab-pane fade show' id='nav-drain' role='tabpanel' aria-labelledby='nav-drain-tab'>
              <form>
                <div className='form-group row'>
                  <label htmlFor='inputEmail3' className='col-sm-4 col-form-label'>Drain by TOTP</label>
                  <div className='col-sm-8'>
                    <input type='number' className='form-control' id='inputEmail3' value={this.state.withdraw_totp} onChange={this.totpChanged.bind(this)} />
                  </div>
                </div>
                <div className='form-group row'>
                  <label htmlFor='inputEmail3' className='col-sm-4 col-form-label' />
                  <div className='col-sm-8'>
                    {!this.state.submitting && <button className='btn btn-primary' onClick={this.drainByTOTP.bind(this)}>Drain</button>}
                    {this.state.submitting && <button className='btn btn-primary' disabled>Submitting..(wait)</button>}
                  </div>
                </div>
              </form>
              <hr />
              <form>
                <div className='form-group row'>
                  <label htmlFor='inputEmail3' className='col-sm-4 col-form-label'>Drain when codes expired & by Draining Address</label>
                  <div className='col-sm-8'>
                    {!this.state.submitting && <button className='btn btn-primary' onClick={this.drain.bind(this)}>Drain</button>}
                    {this.state.submitting && <button className='btn btn-primary' disabled>Submitting..(wait)</button>}
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    )
  }
}

export default ShowWallet
