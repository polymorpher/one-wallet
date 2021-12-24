import React, { useRef } from 'react'
import config from '../../config'
import Row from 'antd/es/row'
import Space from 'antd/es/space'
import Typography from 'antd/es/typography'
import message from '../../message'
import util, { updateQRCodeState } from '../../util'
import QrCodeScanner from '../../components/QrCodeScanner'
import WalletConstants from '../../constants/wallet'
import { useHistory } from 'react-router'
import Paths from '../../constants/paths'
const { Text } = Typography

const Scan = ({ address }) => {
  const state = useRef({ last: undefined, lastTime: Date.now() }).current
  const history = useHistory()
  const onScan = (v) => {
    if (!updateQRCodeState(v, state)) {
      return
    }
    let m = v.match(WalletConstants.qrcodePattern)
    if (!m) {
      m = v.match(WalletConstants.unwrapPattern)
      if (m) {
        message.success('Found red packet. Redirecting...')
        history.push(m[0])
        return
      }
    }
    if (!m) {
      if (v.startsWith(config.rootUrl)) {
        message.erorr('Code recognized. Redirecting...')
        history.push(v)
        return
      }
      message.error('Unrecognizable code')

      return
    }
    const dest = util.safeNormalizedAddress(m[1])
    if (!dest) {
      message.error('Invalid address: ' + dest)
      return
    }
    const callback = Buffer.from(Paths.showAddress(address)).toString('base64')
    const caller = util.ellipsisAddress(util.safeOneAddress(dest))
    history.push(Paths.doAuth('pay') + `?dest=${dest}&from=${address}&caller=${caller}&callback=${callback}`)
  }
  return (
    <>
      <Row style={{ width: '100%', marginTop: 16 }} justify='center'>
        <Space direction='vertical' style={{ textAlign: 'center' }}>
          <Text>Scan 1wallet QR code</Text>
          <QrCodeScanner style={{ minWidth: 300 }} shouldInit onScan={onScan} />
        </Space>
      </Row>
    </>
  )
}
export default Scan
