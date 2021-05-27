import React, { Component } from 'react'
import * as truffleClient from './truffleClient'
import Create from './Create'
import ShowWallet from './showWallet'

class MainScreen extends Component {
  constructor (props) {
    super(props)
    this.state = { wallets: [], create: false }
  }

  componentDidMount () {
    var self = this
    truffleClient.load().then(e => {
      self.setState({ network: window.App.network })
    })
    var wallets = truffleClient.getWallets()
    this.setState({ wallets })
  }

  onSelect (e) {
    console.log(e.target.value)
    this.setState({ 'loaded': e.target.value })
  }
  create (e) {
    e.preventDefault()
    this.setState({ create: true })
  }
  closeCreate () {
    this.setState({ create: false })
  }
  onCreated (contract) {
    this.setState({ create: false, loaded: contract.address })
  }
  render () {
    return (
      <div>
        <nav className='navbar navbar-expand-md navbar-dark bg-dark mb-4 d-flex justify-content-center'>
          <span className='navbar-text '>
                    TOTP Smart Wallet Demo<br />
                    Network: {window.App.network}
          </span>
        </nav>
        <main role='main' className='container' style={{ 'maxWidth': 700 }}>
          <div className='row'>
            <div className='col-sm-12'>
              <div className='mb-3'>Choose Local Wallet:
                <select
                  className='form-control'
                  onBlur={this.onSelect.bind(this)}
                >
                  <option>Choose one</option>
                  {this.state.wallets.map(e => <option key={e.toString()}>{e}</option>)}
                </select>
              </div>
              <i>or</i>
              <div className='mt-3'>
                {!this.state.create && <button className='btn btn-primary' onClick={this.create.bind(this)}>New Wallet</button>}
                {this.state.create && <Create onClose={this.closeCreate.bind(this)} onCreated={this.onCreated.bind(this)} />}
              </div>
            </div>
          </div>
          <div className='row'>
            <div className='col-sm-12'>
              {this.state.loaded && <ShowWallet wallet={this.state.loaded} />}
            </div>
          </div>
        </main>
      </div>
    )
  }
}

export default MainScreen
