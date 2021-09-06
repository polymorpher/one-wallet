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
      containerStyle={{
        flexWrap: 'wrap',
        gap: '5px'
      }}
      inputStyle={{
        width: isMobile ? 40 : 32,
        height: isMobile ? 40 : 32,
        borderRadius: 8,
        borderWidth: 1,
        fontSize: isMobile ? 12 : 16,
        marginRight: isMobile ? 12 : 16,
        ...inputStyle
      }}
      separator={<span> </span>}
      {...params}
    />
  )
}

export default forwardRef(OtpBox)
