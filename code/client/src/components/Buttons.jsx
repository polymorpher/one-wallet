import styled, { keyframes } from 'styled-components'
import Button from 'antd/es/button'

const flashAnimation = keyframes`
  0% {opacity: 0.6;}
  100% {opacity: 1.0;}
`
export const FlashyButton = styled(Button)`
  &:enabled {
    animation: ${flashAnimation} 1s infinite alternate;
  }
`
