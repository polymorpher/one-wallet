import styled, { keyframes } from 'styled-components'
import Button from 'antd/es/button'
import CloseOutlined from '@ant-design/icons/CloseOutlined'
import React from 'react'

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
