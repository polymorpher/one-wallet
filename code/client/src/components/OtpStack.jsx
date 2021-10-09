import { Space, Tooltip } from 'antd'
import { Hint, Label } from './Text'
import OtpBox from './OtpBox'
import { QuestionCircleOutlined } from '@ant-design/icons'
import React, { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router'

export const useOtpState = () => {
  const [otpInput, setOtpInput] = useState('')
  const [otp2Input, setOtp2Input] = useState('')
  const otpRef = useRef()
  const otp2Ref = useRef()
  const resetOtp = () => {
    setOtpInput('')
    setOtp2Input('')
    otpRef?.current?.focusInput(0)
  }
  return { state: { otpRef, otp2Ref, otpInput, otp2Input, setOtpInput, setOtp2Input, resetOtp } }
}

export const OtpStack = ({ wideLabel, walletName, otpState, doubleOtp, onComplete, action }) => {
  const location = useLocation()
  const { otpRef, otp2Ref, otpInput, otp2Input, setOtpInput, setOtp2Input, resetOtp } = otpState || useOtpState()

  useEffect(() => {
    // Focus on OTP 2 input box when first OTP input box is filled.
    if (otpInput.length === 6 && doubleOtp) {
      // For some reason if the OTP input never been focused or touched by user before, it cannot be focused to index 0 programmatically, however focus to index 1 is fine. So as a workaround we focus on next input first then focus to index 0 box. Adding setTimeout 0 to make focus on index 0 run asynchronously, which gives browser just enough time to react the previous focus before we set the focus on index 0.
      otp2Ref?.current?.focusNextInput()
      setTimeout(() => otp2Ref?.current?.focusInput(0), 0)
    } else if (otpInput.length === 6 && onComplete) {
      onComplete()
    }
  }, [otpInput])

  useEffect(() => {
    if (otpInput.length === 6 && doubleOtp && otp2Input.length === 6 && onComplete) {
      onComplete()
    }
  }, [otp2Input])

  useEffect(() => {
    resetOtp && resetOtp() // Reset TOP input boxes on location change to make sure the input boxes are cleared.
  }, [location])

  return (
    <Space direction='vertical'>
      <Space align='baseline' size='large' style={{ marginTop: 16 }}>
        <Label wide={wideLabel}>
          <Hint>Code {doubleOtp ? '1' : ''}</Hint>
        </Label>
        <OtpBox
          ref={otpRef}
          value={otpInput}
          onChange={setOtpInput}
        />
        <Tooltip title={`from your Google Authenticator, i.e. ${walletName}`}>
          <QuestionCircleOutlined />
        </Tooltip>
      </Space>
      {doubleOtp &&
        <Space align='baseline' size='large' style={{ marginTop: 16 }}>
          <Label wide={wideLabel}>
            <Hint>Code 2</Hint>
          </Label>
          <OtpBox
            ref={otp2Ref}
            value={otp2Input}
            onChange={setOtp2Input}
          />
          <Tooltip title={`from your Google Authenticator, i.e. ${walletName} (2nd)`}>
            <QuestionCircleOutlined />
          </Tooltip>
        </Space>}
      {action && <Space align='baseline'><Label wide={wideLabel} /><Hint style={{ marginLeft: 16 }}>({action})</Hint></Space>}
    </Space>
  )
}
