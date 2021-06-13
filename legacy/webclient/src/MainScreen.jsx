import React, { useEffect, useState } from 'react'
import * as truffleClient from './truffleClient'
import Create from './Create'
import ShowWallet from './showWallet'
import BenchmarkPage from './BenchmarkHash'
import Tab from 'react-bootstrap/Tab'
import Container from 'react-bootstrap/Container'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import Nav from 'react-bootstrap/Nav'
import styled from 'styled-components'

const Branding = styled.div`
  text-align: center;
  font-size: 1.25em;
  margin: 32px auto;
`
const BrandingTitle = styled.div`
  font-weight: bold;
`
const BrandingVersion = styled.div`
  color: #888888;
`
const BrandingMinor = styled.div`
  color: #aaaaaa;
  font-size: 0.75em;
`

const Body = styled(Container)`
  padding-top: 32px;
`

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
    <Tab.Container id='left-tabs-example' defaultActiveKey='console'>
      <Row>
        <Col sm={3}>
          <Nav variant='pills' className='flex-column'>
            <Nav.Item>
              <Branding>
                <BrandingTitle>ONE Wallet</BrandingTitle>
                <BrandingVersion>v0.0.1</BrandingVersion>
                <BrandingMinor>Network: {network}</BrandingMinor>
              </Branding>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey='console'>Developer Console</Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey='benchmark'>Hash Benchmark</Nav.Link>
            </Nav.Item>
          </Nav>
        </Col>
        <Col sm={9}>
          <Tab.Content>
            <Tab.Pane eventKey='benchmark'>
              <Body>
                <BenchmarkPage />
              </Body>
            </Tab.Pane>
            <Tab.Pane eventKey='console'>
              <Body>
                <Row>
                  <Col sm={12}>
                    <div className='mb-3'>Choose Local Wallet:
                      <select
                        className='form-control'
                        onBlur={onSelected}
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
                  </Col>
                </Row>
                <Row>
                  <Col sm={12}>
                    {loadedWallet && <ShowWallet wallet={loadedWallet} />}
                  </Col>
                </Row>
              </Body>
            </Tab.Pane>
          </Tab.Content>
        </Col>
      </Row>

    </Tab.Container>
  )
}
export default MainScreen
