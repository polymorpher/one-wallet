import OtpInput from 'react-otp-input'
import React from 'react'
import { useWindowDimensions } from '../util'

const OtpBox = ({ onChange, value, inputStyle, ...params }) => {
  const { isMobile } = useWindowDimensions()
  return (
    <OtpInput
      placeholder=''
      value={value}
      onChange={onChange}
      numInputs={6}
      inputStyle={{ width: isMobile ? 24 : 32, borderRadius: 8, borderWidth: 1, height: isMobile ? 24 : 32, fontSize: isMobile ? 12 : 16, marginRight: isMobile ? 8 : 16, ...inputStyle }}
      separator={<span> </span>}
      {...params}
    />
  )
}

export default OtpBox
