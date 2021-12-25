import { Hint } from './Text'
import OtpBox from './OtpBox'
import Button from 'antd/es/button'
import Checkbox from 'antd/es/checkbox'
import Space from 'antd/es/space'
import Tooltip from 'antd/es/tooltip'
import QuestionCircleOutlined from '@ant-design/icons/QuestionCircleOutlined'
import SnippetsOutlined from '@ant-design/icons/SnippetsOutlined'
import React from 'react'

export const OtpSetup = ({ isMobile, otpRef, otpValue, setOtpValue, name }) => {
  return (
    <Space direction='vertical' size='large' align='center' style={{ width: '100%' }}>
      <Hint>Copy the 6-digit code from authenticator</Hint>
      <Hint style={{ fontSize: isMobile ? 12 : undefined }}>
        Code for <b>Harmony ({name})</b>
      </Hint>
      <OtpBox
        shouldAutoFocus={!isMobile}
        ref={otpRef}
        value={otpValue}
        onChange={setOtpValue}
        numOnly={isMobile}
      />
      {isMobile && <Button type='default' shape='round' icon={<SnippetsOutlined />} onClick={() => { navigator.clipboard.readText().then(t => setOtpValue(t)) }}>Paste from Clipboard</Button>}
    </Space>
  )
}

export const TwoCodeOption = ({ doubleOtp, setDoubleOtp, isMobile }) => {
  return (
    <Checkbox onChange={() => setDoubleOtp(!doubleOtp)}>
      <Space>
        <Hint style={{ fontSize: isMobile ? 12 : undefined }}>
          Use two codes to enhance security
        </Hint>
        <Tooltip title={<div>You will need to scan another QR-code on the next page. Each time you make a transaction, you will need to type in two 6-digit codes, which are shown simultaneously next to each other on your Google Authenticator.<br /><br />This is advisable if you intend to make larger transactions with this wallet</div>}>
          <QuestionCircleOutlined />
        </Tooltip>
      </Space>
    </Checkbox>
  )
}
