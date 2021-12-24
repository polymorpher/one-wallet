import Space from 'antd/es/space'
import Typography from 'antd/es/typography'
import Button from 'antd/es/button'
import Divider from 'antd/es/divider'

import React, { useState } from 'react'
import { TallRow } from '../../components/Grid'
import { NFTGrid } from '../../components/NFTGrid'

import BuyDaVinci from './BuyDaVinci'
const { Title } = Typography

const sections = {
  home: '',
  davinci: 'davinci',
}

const NFTDashboard = ({ address }) => {
  const [section, setSection] = useState(sections.home)

  if (section === sections.davinci) {
    return (
      <BuyDaVinci
        address={address} onClose={() => setSection(sections.home)} onSuccess={() => {
          setSection(sections.home)
        }}
      />
    )
  }

  return (
    <Space direction='vertical' style={{ width: '100%' }}>
      <Title level={2}>Purchase Collectibles</Title>
      <TallRow justify='center'>
        <Button onClick={() => setSection(sections.davinci)} type='primary' shape='round' size='large'>Buy from daVinci</Button>
      </TallRow>
      <Divider />
      <Title level={2}>Your Collectibles</Title>
      <NFTGrid address={address} />
    </Space>
  )
}

export default NFTDashboard
