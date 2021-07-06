// eslint-disable-next-line no-unused-vars
import React from 'react'
import styled from 'styled-components'
import { Input, Typography, Card } from 'antd'

const { Text, Title } = Typography

export const Heading = styled(Title).attrs(() => ({ level: 2 }))`
  //font-size: 24px;
  //color: #1f1f1f;
`

export const Hint = styled(Text).attrs(() => ({ type: 'secondary' }))`
  font-size: 16px;
  color: #888888;
`

export const InputBox = styled(Input).attrs((props) => ({ size: props.size || 'large' }))`
  width: ${props => `${props.width || 400}px`};
  margin-top: ${props => props.margin || '32px'};
  margin-bottom: ${props => props.margin || '32px'};
  border: none;
  border-bottom: 1px dashed black;
  &:hover{
    border-bottom: 1px dashed black;
  }
`

export const Warning = ({ children, ...props }) =>
  <Card style={{ borderRadius: 8, backgroundColor: '#f3cbcb', fontSize: 16 }} bodyStyle={{ padding: 16, paddingLeft: 24, paddingRight: 24 }}>
    <Text>{children}
    </Text>
  </Card>
