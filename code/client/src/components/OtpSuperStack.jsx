import React from 'react'
import { Space } from 'antd'
import { useOtpState, OtpStack } from './OtpStack'

// a stack of 6 otps
export const OtpSuperStack = ({
  isDisabled, shouldAutoFocus, wideLabel, walletName, onComplete, action,
  otpStates = new Array(6).map(() => useOtpState())
}) => {
  const handleOnComplete = function (i) {
    if (i === 5) {
      const inputs = otpStates.map(s => s.otpInput)
      onComplete && onComplete(inputs)
    } else {
      otpStates[i].otpRef.current?.focusNextInput()
      setTimeout(() => otpStates[i].otpRef.current?.focusInput(0), 0)
    }
  }

  return (
    <Space direction='vertical'>
      {new Array(6).map((_, i) =>
        <OtpStack
          key={`otp-${i}`}
          label={`${i + 1}`}
          otpState={otpStates[i]}
          onComplete={() => handleOnComplete(i)}
          wideLabel={wideLabel}
          walletName={walletName}
          shouldAutoFocus={i === 0 && shouldAutoFocus}
          isDisabled={isDisabled}
          action={i === 5 && action}
        />
      )}
    </Space>
  )
}
