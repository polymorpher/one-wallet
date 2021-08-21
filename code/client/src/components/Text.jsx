// eslint-disable-next-line no-unused-vars
import React, { useEffect, useRef, useState } from 'react'
import styled from 'styled-components'
import { Input, Typography, Card } from 'antd'
import util from '../util'

const { Text, Title, Link } = Typography

export const Heading = styled(Title).attrs(() => ({ level: 2 }))`
  //font-size: 24px;
  //color: #1f1f1f;
`

export const Hint = styled(Text).attrs(() => ({ type: 'secondary' }))`
  font-size: 16px;
  color: #888888;
`

export const InputBox = styled(Input).attrs((props) => ({ size: props.size || 'large' }))`
  width: ${props => typeof props.width === 'number' ? `${props.width || 400}px` : (props.width || 'auto')};
  margin-top: ${props => props.margin || '32px'};
  margin-bottom: ${props => props.margin || '32px'};
  border: none;
  border-bottom: 1px dashed black;
  &:hover{
    border-bottom: 1px dashed black;
  }
`

export const AutoResizeInputBox = ({ value, style, onChange, ...args }) => {
  const ref = useRef()
  const [width, setWidth] = useState()
  useEffect(() => {
    setWidth(util.getTextWidth(value, null, ref.current?.input))
  }, [value.length])
  return <InputBox width={width} ref={ref} style={style} value={value} onChange={onChange} {...args} />
}

export const Warning = ({ children, style, ...props }) =>
  <Card style={{ borderRadius: 8, backgroundColor: '#f3cbcb', fontSize: 16, ...style }} bodyStyle={{ padding: 16, paddingLeft: 24, paddingRight: 24 }}>
    <Text>{children}</Text>
  </Card>

export const Label = styled.div`
  width: 64px;
`

export const ExplorerLink = styled(Link).attrs(e => ({ ...e, style: { color: '#888888' }, target: '_blank', rel: 'noopener noreferrer' }))`
  ${props => props['data-show-on-hover'] && 'opacity: 0.1;'}
  &:hover {
    opacity: ${props => props['data-show-on-hover'] ? 1.0 : 0.8};
  }
`
