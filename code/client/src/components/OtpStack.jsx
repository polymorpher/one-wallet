import { Button, Space, Tooltip } from 'antd'
import { Hint, Label } from './Text'
import OtpBox from './OtpBox'
import { QuestionCircleOutlined, SnippetsOutlined } from '@ant-design/icons'
import React, { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router'
import { useWindowDimensions } from '../util'

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

export const OtpStack = ({ isDisabled, shouldAutoFocus, wideLabel, walletName, otpState, doubleOtp = otpState?.doubleOtp, onComplete, action, label, label2 }) => {
  const { isMobile } = useWindowDimensions()
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
      <Space align='center' size='large' style={{ marginTop: 16 }}>
        <Label wide={wideLabel}>
          <Hint>Code {label || (doubleOtp ? '1' : '')}</Hint>
        </Label>
        <OtpBox
          ref={otpRef}
          value={otpInput}
          onChange={setOtpInput}
          shouldAutoFocus={shouldAutoFocus}
          containerStyle={{ maxWidth: isMobile ? 176 : '100%' }}
          isDisabled={isDisabled}
        />
        <Space direction='vertical' align='center'>
          <Tooltip title={`from your Google Authenticator, i.e. ${walletName}`}>
            <QuestionCircleOutlined />
          </Tooltip>
          {isMobile && <Button type='default' shape='round' icon={<SnippetsOutlined />} onClick={() => { navigator.clipboard.readText().then(t => setOtpInput(t)) }} />}
        </Space>
      </Space>
      {doubleOtp &&
        <Space align='baseline' size='large' style={{ marginTop: 16 }}>
          <Label wide={wideLabel}>
            <Hint>Code {label2 || '2'}</Hint>
          </Label>
          <OtpBox
            ref={otp2Ref}
            value={otp2Input}
            onChange={setOtp2Input}
            containerStyle={{ maxWidth: isMobile ? 176 : '100%' }}
            isDisabled={isDisabled}
          />
          <Space direction='vertical' align='center'>
            <Tooltip title={`from your Google Authenticator, i.e. ${walletName} (2nd)`}>
              <QuestionCircleOutlined />
            </Tooltip>
            {isMobile && <Button type='default' shape='round' icon={<SnippetsOutlined />} onClick={() => { navigator.clipboard.readText().then(t => setOtp2Input(t)) }} />}
          </Space>
        </Space>}
      {action && <Space align='baseline'><Label wide={wideLabel} /><Hint style={{ marginLeft: 16 }}>({action})</Hint></Space>}
    </Space>
  )
}
