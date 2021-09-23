import styled, { keyframes } from 'styled-components'
import { Button } from 'antd'

const flashAnimation = keyframes`
  0% {box-shadow: 0 0 0 lightblue;}
  90% {box-shadow: 0 0 0 lightblue;}
  95% {box-shadow: 0 0 10px lightblue;}
  100% {box-shadow: 0 0 0 lightblue;}
`
export const FlashyButton = styled(Button)`
  animation: ${flashAnimation} 3s infinite;
`
