import Button from 'antd/es/button'
import Card from 'antd/es/card'
import Popconfirm from 'antd/es/popconfirm'
import Row from 'antd/es/row'
import Space from 'antd/es/space'
import Typography from 'antd/es/typography'
import { AverageRow } from './Grid'
import { deleteWalletLocally } from '../storage/util'
import { DeleteOutlined } from '@ant-design/icons'
import React from 'react'
const { Text, Title, Link, Paragraph } = Typography

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
