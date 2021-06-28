import OtpInput from 'react-otp-input'
import React from 'react'

const OtpBox = ({ onChange, value, inputStyle, ...params }) => {
  return (
    <OtpInput
      placeholder=''
      value={value}
      onChange={onChange}
      numInputs={6}
      inputStyle={{ width: 32, borderRadius: 8, borderWidth: 1, height: 32, fontSize: 16, marginRight: 16, ...inputStyle }}
      separator={<span> </span>}
      {...params}
    />
  )
}

export default OtpBox
