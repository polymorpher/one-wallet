import styled, { keyframes } from 'styled-components'
import Button from 'antd/es/button'
import CloseOutlined from '@ant-design/icons/CloseOutlined'
import React from 'react'
import { useTheme, getColorPalette } from '../theme'

const flashAnimation = keyframes`
  0% {opacity: 0.6;}
  100% {opacity: 1.0;}
`
export const FlashyButton = styled(Button)`
  &:enabled {
    animation: ${flashAnimation} 1s infinite alternate;
  }
`
export const CloseButton = ({ onClose }) => <Button type='text' icon={<CloseOutlined />} onClick={onClose} />

export const PrimaryButton = ({ ...args }) => {
  const { primaryButtonBgColor, buttonTextColor } = getColorPalette(useTheme())
  return <Button {...args} style={{ ...args.style, backgroundColor: primaryButtonBgColor, color: buttonTextColor }} />
}

export const SecondaryButton = ({ ...args }) => {
  const { secondaryButtonBgColor, buttonTextColor } = getColorPalette(useTheme())
  return <Button {...args} style={{ ...args.style, backgroundColor: secondaryButtonBgColor, color: buttonTextColor }} />
}
