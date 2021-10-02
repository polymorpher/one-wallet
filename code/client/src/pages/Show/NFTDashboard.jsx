import { Card, Image, Row, Space, Typography, Col, Button, message, Carousel, Divider, Select } from 'antd'
import { unionWith, differenceBy } from 'lodash'
import walletActions from '../../state/modules/wallet/actions'
import React, { useState, useEffect } from 'react'
import { AverageRow, TallRow } from '../../components/Grid'
import { api } from '../../../../lib/api'
import util, { useWindowDimensions } from '../../util'
import { Warning, Heading, Hint, InputBox, Label } from '../../components/Text'
import { DefaultNFTs, NFTMetadataTransformer, withKeys } from '../../components/TokenAssets'
import { useDispatch, useSelector } from 'react-redux'
import ONEConstants from '../../../../lib/constants'
import { FallbackImage } from '../../constants/ui'
import styled from 'styled-components'
import { LeftOutlined, RightOutlined } from '@ant-design/icons'
import Paths from '../../constants/paths'
import { useHistory } from 'react-router'
import WalletAddress from '../../components/WalletAddress'
import { NFTGrid } from '../../components/NFTGrid'
import { handleTrackNewToken } from '../../components/ERC20Grid'
import { handleAddressError } from '../../handler'
import ONEUtil from '../../../../lib/util'
import ONE from '../../../../lib/onewallet'
import BN from 'bn.js'
const { Text, Title, Link } = Typography

const sections = {
  home: '',
  davinci: 'davinci',
}

const NFTDashboard = ({ address }) => {
  const [section, setSection] = useState(sections.home)

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
