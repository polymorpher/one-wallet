import styled, { keyframes } from 'styled-components'
import { Button } from 'antd'

const flashAnimation = keyframes`
  0% {box-shadow: 0 0 0 lightblue;}
  5% {box-shadow: 0 0 20px lightblue;}
  7% {box-shadow: 0 0 0 lightblue;}
  10% {box-shadow: 0 0 0 lightblue;}
  15% {box-shadow: 0 0 20px lightblue;}
  17% {box-shadow: 0 0 0 lightblue;}
  100% {box-shadow: 0 0 0 lightblue;}
`
export const FlashyButton = styled(Button)`
  animation: ${flashAnimation} 3s 2;
`
