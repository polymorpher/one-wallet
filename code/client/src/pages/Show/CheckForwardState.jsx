import { useDispatch, useSelector } from 'react-redux'
import React, { useEffect, useState } from 'react'
import ONEConstants from '../../../../lib/constants'
import util, { useWindowDimensions } from '../../util'
import Button from 'antd/es/button'
import Card from 'antd/es/card'
import Typography from 'antd/es/typography'
import Space from 'antd/es/space'
import Row from 'antd/es/row'
import Spin from 'antd/es/spin'
import Popconfirm from 'antd/es/popconfirm'
import message from '../../message'
import { api } from '../../../../lib/api'
import { walletActions } from '../../state/modules/wallet'
import { useHistory } from 'react-router'
import Paths from '../../constants/paths'
import WalletAddress from '../../components/WalletAddress'
import { DeleteOutlined } from '@ant-design/icons'
import { deleteWalletLocally } from '../../storage/util'
const { Title, Text } = Typography

const CardStyle = {
  backgroundColor: 'rgba(0,0,0,0.15)',
  position: 'absolute',
  width: '100%',
  height: '100%',
  left: 0,
  top: 0,
  zIndex: 100,
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)'
}

const CheckForwardState = ({ address, onClose }) => {
  const { isMobile } = useWindowDimensions()
  const history = useHistory()
  const dispatch = useDispatch()
  const wallets = useSelector(state => state.wallet)
  const wallet = wallets[address] || {}
  const [skip, setSkip] = useState(false)
  const [isPostRecovery, setIsPostRecovery] = useState(false)
  const { forwardAddress, temp, lastResortAddress, recoveryTime } = wallet
  const [checkedForwardState, setCheckedForwardState] = useState(false)
  const [checkedForwardStateError, setCheckedForwardStateError] = useState('')

  useEffect(() => {
    const f = async () => {
      if (recoveryTime) {
        setIsPostRecovery(true)
        setCheckedForwardState(true)
        return
      }
      if (forwardAddress && !util.isEmptyAddress(forwardAddress) && !temp) {
        let backlinks = []
        try {
          backlinks = await api.blockchain.getBacklinks({ address: forwardAddress })
        } catch (ex) {
          console.error(ex)
          // const errorMessage = ex.toString()
          // if (!(errorMessage.includes('no code at address') || errorMessage.includes('Returned values aren\'t valid'))) {
          //   setCheckedForwardStateError(ex.toString())
          // }
        }
        if (backlinks && backlinks.includes(address)) {
          dispatch(walletActions.updateWallet({ ...wallet, address: forwardAddress, forwardAddress: ONEConstants.EmptyAddress }))
          dispatch(walletActions.deleteWallet(address))
          message.success('Detected upgraded version of this wallet. Redirecting there...')
          setTimeout(() => history.push(Paths.showAddress(forwardAddress)), 500)
        } else {
          setIsPostRecovery(true)
          dispatch(walletActions.updateWallet({ ...wallet, recoveryTime: Date.now() }))
        }

        setCheckedForwardState(true)
      }
    }
    f()
  }, [temp, forwardAddress])

  if (!forwardAddress || util.isEmptyAddress(forwardAddress) || skip || temp) {
    return <></>
  }

  return (
    <Card style={CardStyle} bodyStyle={{ height: '100%' }}>
      <Row justify='center'>
        <Space
          direction='vertical'
          size='large'
          style={{
            height: '100%',
            width: '100%',
            maxWidth: 400,
            justifyContent: 'start',
            paddingTop: isMobile ? 32 : 192,
            display: 'flex'
          }}
        >
          {!checkedForwardState &&
            <>
              <Title level={isMobile ? 4 : 2}><Space size='large'><Spin />Checking Wallet Status</Space></Title>
              <Text>This wallet appears to be deprecated. Please wait while we are analyzing why....</Text>
            </>}
          {checkedForwardState && checkedForwardStateError &&
            <>
              <Title level={isMobile ? 4 : 2}><Space size='large'>Cannot Check Wallet Status</Space></Title>
              <Text>An error occurred. Please try refreshing the page. Details:</Text>
              <Text style={{ color: 'red' }}>{checkedForwardStateError}</Text>
              <Text>If you keep seeing this, please report the bug on Github and attached your wallet address and a screenshot in your post.</Text>
            </>}
          {checkedForwardState && isPostRecovery &&
            <>
              <Row justify='center'><Space><Title level={isMobile ? 4 : 2}>This wallet is deprecated</Title></Space></Row>
              <Text>Assets were already transferred to recovery address. All collectibles and funds sent to this wallet will be forwarded to the recovery address</Text>
              <Text>The recovery address is: </Text>
              <WalletAddress showLabel address={lastResortAddress} alwaysShowOptions />
              <Text>If you have any asset left in this wallet, you can still inspect this wallet and manually transfer them out.</Text>
              <Row justify='center'>
                <Space direction='vertical' size='large' align='center'>
                  <Button type='primary' shape='round' onClick={onClose}>Exit</Button>
                  <Button type='default' shape='round' onClick={() => setSkip(true)}>Inspect Wallet</Button>
                  <Popconfirm title='Are you sure？' onConfirm={() => deleteWalletLocally({ wallet, wallets, history, dispatch })}>
                    <Button type='text' shape='round' danger size='large' icon={<DeleteOutlined />}>Delete Locally</Button>
                  </Popconfirm>
                </Space>
              </Row>

            </>}
        </Space>
      </Row>
    </Card>

  )
}
export default CheckForwardState
