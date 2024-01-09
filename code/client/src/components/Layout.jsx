import React from 'react'
import Card from 'antd/es/card'
import Row from 'antd/es/row'
import Space from 'antd/es/space'
import styled from 'styled-components'

const CardStyle = {
  backgroundColor: 'rgba(0,0,0,0.15)',
  position: 'absolute',
  width: '100%',
  height: '100%',
  left: 0,
  top: 0,
  zIndex: 100,
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)'
}

export const SpaceCapped = ({ isMobile, children }) => {
  return (
    <Space
      direction='vertical'
      size='large'
      style={{
        height: '100%',
        width: '100%',
        maxWidth: 400,
        justifyContent: 'start',
        paddingTop: isMobile ? 32 : 192,
        display: 'flex'
      }}
    >
      {children}
    </Space>
  )
}

export const FloatContainer = ({ isMobile, children }) => {
  return (
    <Card style={CardStyle} bodyStyle={{ height: '100%' }}>
      <Row justify='center'>
        <SpaceCapped isMobile={isMobile}>{children}</SpaceCapped>
      </Row>
    </Card>
  )
}

export const Spacer = styled.div`
  height: ${props => props.$height || '32px'}
`
