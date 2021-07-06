import React, { useState, useEffect } from 'react'
import { useHistory, useRouteMatch } from 'react-router'
import { Layout, Image, Menu, Row, Typography } from 'antd'
import { PlusCircleOutlined, UnorderedListOutlined, HistoryOutlined } from '@ant-design/icons'
import HarmonyLogo from '../assets/harmony.svg'
import HarmonyIcon from '../assets/harmony-icon.svg'
import config from '../config'
import Paths from '../constants/paths'
import styled from 'styled-components'
import util, { useWindowDimensions } from '../util'

const { Link } = Typography

const Text = styled.p`
  color: #fafafa;
  text-align: center;
  a, a:hover {
    color: #fafafa;
  }
`

const Stats = styled.p`
  color: #ccc;
`

const SiderMenu = ({ ...args }) => {
  const { width } = useWindowDimensions()
  const history = useHistory()
  const [collapsed, setCollapsed] = useState()
  const match = useRouteMatch('/:action')
  const { action } = match ? match.params : {}
  const nav = ({ key }) => {
    history.push(Paths[key])
  }
  const [stats, setStats] = useState(null)

  useEffect(() => {
    async function getStats () {
      const statsData = await util.getWalletStats()
      setStats(statsData)
    }
    getStats()
  }, [])

  return (
    <Layout.Sider collapsible={width < 900} onCollapse={c => setCollapsed(c)} {...args}>
      {/* <Image src='/assets/harmony.svg' /> */}
      <Row justify='center'>
        <Link target='_blank' rel='noopener noreferrer' href='https://harmony.one/'>
          <Image preview={false} src={collapsed ? HarmonyIcon : HarmonyLogo} style={{ cursor: 'pointer', padding: collapsed ? 16 : 32 }} onClick={() => history.push('/')} />
        </Link>
      </Row>
      {!collapsed && <Text><Link href='https://harmony.one/1wallet' target='_blank' rel='noopener noreferrer'>{config.appName} {config.version}</Link></Text>}
      <Row justify='center'><Stats>{stats && stats.count.toLocaleString()} wallets</Stats></Row>
      <Row justify='center' style={{ marginBottom: 10 }}><Stats>{stats && stats.totalAmount.toLocaleString()} ONE</Stats></Row>
      <Menu theme='dark' mode='inline' onClick={nav} selectedKeys={[action]}>
        <Menu.Item key='create' icon={<PlusCircleOutlined />}>Create</Menu.Item>
        <Menu.Item key='wallets' icon={<UnorderedListOutlined />}>Wallets</Menu.Item>
        <Menu.Item key='restore' icon={<HistoryOutlined />}>Restore</Menu.Item>
      </Menu>

    </Layout.Sider>
  )
}

export default SiderMenu
