import qrcode from 'qrcode'
import React, { useEffect, useState, useRef } from 'react'
import config from '../../config'
import html2canvas from 'html2canvas'
import { Button, Image, message, Row, Space, Typography } from 'antd'
import util from '../../util'
import QrCodeScanner from '../../components/QrCodeScanner'
import WalletConstants from '../../constants/wallet'
import { useHistory } from 'react-router'
import Paths from '../../constants/paths'
const { Text } = Typography

const Scan = ({ address }) => {
  const history = useHistory()
  const onScan = (v) => {
    if (!v) {
      return
    }
    const pattern = WalletConstants.qrcodePattern
    const m = v.match(pattern)
    if (!m) {
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
