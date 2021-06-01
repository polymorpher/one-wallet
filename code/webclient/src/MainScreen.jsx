import React, { useEffect, useState } from 'react'
import * as truffleClient from './truffleClient'
import Create from './Create'
import ShowWallet from './showWallet'

const MainScreen = () => {
  const [network, setNetwork] = useState()
  const [wallets, setWallets] = useState()
  const [loadedWallet, setLoadedWallet] = useState()
  const [showCreate, setShowCreate] = useState(false)
  useEffect(() => {
    const f = async () => {
      await truffleClient.load()
      setNetwork(window.App.network)
      const w = truffleClient.getWallets()
      if (w) {
        setWallets(w)
      }
    }
    f()
  }, [])

  const onSelected = (e) => {
    if (!e.target) {
      return
    }
    const o = e.target.selectedOptions[0]
    if (!o) {
      return
    }
    const w = o.getAttribute('data-wallet')
    console.log(`selected ${e.target.value}  | data-wallet=${w}`)
    setLoadedWallet(w)
  }
  const onCreated = (contract) => {
    setShowCreate(true)
    setLoadedWallet(contract.address)
  }
  return (
    <div>
      <nav className='navbar navbar-expand-md navbar-dark bg-dark mb-4 d-flex justify-content-center'>
        <span className='navbar-text '>
                    TOTP Smart Wallet Demo<br />
                    Network: {network}
        </span>
      </nav>
      <main role='main' className='container' style={{ 'maxWidth': 700 }}>
        <div className='row'>
          <div className='col-sm-12'>
            <div className='mb-3'>Choose Local Wallet:
              <select
                className='form-control'
                onChange={onSelected}
              >
                <option>Choose one</option>
                {wallets && wallets.map(e => <option key={e.toString()} data-wallet={e.toString()}>{e}</option>)}
              </select>
            </div>
            <i>or</i>
            <div className='mt-3'>
              <button className='btn btn-primary' onClick={() => setShowCreate(true)} disabled={showCreate}>New Wallet</button>
              {showCreate && <Create onClose={() => setShowCreate(false)} onCreated={onCreated} />}
            </div>
          </div>
        </div>
        <div className='row'>
          <div className='col-sm-12'>
            {loadedWallet && <ShowWallet wallet={loadedWallet} />}
          </div>
        </div>
      </main>
    </div>
  )
}
export default MainScreen
