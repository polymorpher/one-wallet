import OtpInput from 'react-otp-input'
import React, { forwardRef } from 'react'
import { useWindowDimensions } from '../util'

const OtpBox = ({ onChange, value, inputStyle, ...params }, ref) => {
  const { isMobile } = useWindowDimensions()
  return (
    <OtpInput
      placeholder=''
      value={value}
      ref={ref}
      onChange={onChange}
      numInputs={6}
      inputStyle={{ width: isMobile ? 24 : 32, borderRadius: 8, borderWidth: 1, height: isMobile ? 24 : 32, fontSize: isMobile ? 12 : 16, marginRight: isMobile ? 8 : 16, ...inputStyle }}
      separator={<span> </span>}
      {...params}
    />
  )
}

export default forwardRef(OtpBox)
