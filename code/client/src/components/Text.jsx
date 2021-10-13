// eslint-disable-next-line no-unused-vars
import React, { useEffect, useRef, useState } from 'react'
import styled from 'styled-components'
import { Input, Typography, Card, Col, Spin } from 'antd'
import util from '../util'
import { AverageRow } from './Grid'

const { Text, Title, Link, Paragraph } = Typography

export const Heading = styled(Title).attrs((props) => ({ level: 2, ...props }))`
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

export const AutoResizeInputBox = ({ extraWidth = 0, value, style, onChange, ...args }) => {
  const ref = useRef()
  const [width, setWidth] = useState()
  useEffect(() => {
    setWidth(util.getTextWidth(value, null, ref.current?.input))
  }, [value.length])
  return <InputBox width={(width + extraWidth) || 'auto'} ref={ref} style={style} value={value} onChange={onChange} {...args} />
}

export const Warning = ({ children, info, style, ...props }) =>
  <Card style={{ borderRadius: 8, backgroundColor: info ? '#fffbe6' : '#f3cbcb', fontSize: 16, ...style }} bodyStyle={{ padding: 16, paddingLeft: 24, paddingRight: 24 }}>
    <Text>{children}</Text>
  </Card>

export const NormalLabel = styled.div`
  width: 64px;
`
export const WideLabel = styled.div`
  width: 96px;
`
export const UltraWideLabel = styled.div`
  width: 128px;
`

export const Label = ({ ultraWide, wide, children, ...props }) => {
  if (ultraWide) {
    return <UltraWideLabel {...props}>{children}</UltraWideLabel>
  }
  if (wide) {
    return <WideLabel {...props}>{children}</WideLabel>
  }
  return <NormalLabel {...props}>{children}</NormalLabel>
}

export const ExplorerLink = styled(Link).attrs(e => ({ ...e, style: { color: '#888888' }, target: '_blank', rel: 'noopener noreferrer' }))`
  ${props => props['data-show-on-hover'] && 'opacity: 0.1;'}
  &:hover {
    opacity: ${props => props['data-show-on-hover'] ? 1.0 : 0.8};
  }
`

export const Ul = styled.ul`
  list-style: none!important;
  margin-left: 0;
  padding-left: 1em;
  text-indent: -1em;
`
export const Li = styled(Paragraph)`
  word-break: break-word;
  overflow-wrap: break-word;
  white-space: break-spaces;
  text-overflow: ellipsis;
`

export const LabeledRow = ({ label, doubleRow = false, ultrawide = false, isMobile, wide = !isMobile, children, labelSpan = 4, align = 'baseline', pending = false }) => {
  return (
    <AverageRow align={align}>
      <Col xs={isMobile && doubleRow ? 24 : labelSpan}>
        <Label ultrawide={ultrawide} wide={wide} style={{ fontSize: isMobile ? '12px' : undefined }}>
          <Hint>{label}</Hint>
        </Label>
      </Col>
      <Col xs={isMobile && doubleRow ? 24 : 24 - labelSpan}>
        {pending ? <Spin /> : children}
      </Col>
    </AverageRow>
  )
}
