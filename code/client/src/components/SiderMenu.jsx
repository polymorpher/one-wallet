import React, { useState, useEffect } from 'react'
import { useHistory, useRouteMatch } from 'react-router'
import { Layout, Image, Menu, Row, Typography, Tag, Divider } from 'antd'
import { PlusCircleOutlined, UnorderedListOutlined, HistoryOutlined, AuditOutlined, GithubOutlined, InfoCircleOutlined } from '@ant-design/icons'
import HarmonyLogo from '../assets/harmony.svg'
import HarmonyIcon from '../assets/harmony-icon.svg'
import config from '../config'
import Paths from '../constants/paths'
import styled from 'styled-components'
import { useWindowDimensions } from '../util'
import api from '../api'
import * as Sentry from '@sentry/browser'

const { Link } = Typography

const SiderLink = styled(Link).attrs((e) => ({
  ...e,
  style: { color: '#fafafa', ...e.style },
  target: '_blank',
  rel: 'noopener noreferrer'
}))`
  &:hover {
    opacity: 0.8;
  }
`

const LineDivider = ({ children }) => {
  return (
    <Divider style={{ borderColor: '#fafafa', opacity: 0.5, color: '#fafafa', fontSize: 14 }}>
      {children}
    </Divider>
  )
}

const SiderMenu = ({ ...args }) => {
  const { isMobile } = useWindowDimensions()
  const history = useHistory()
  const match = useRouteMatch('/:action')
  const { action } = match ? match.params : {}
  const nav = ({ key }) => {
    history.push(Paths[key])
  }
  const [stats, setStats] = useState(null)

  useEffect(() => {
    async function getStats () {
      try {
        const statsData = await api.walletStats.getStats()
        setStats(statsData)
      } catch (ex) {
        Sentry.captureException(ex)
        console.error(ex)
      }
    }
    getStats()
  }, [])

  return (
    <Layout.Sider collapsed={isMobile} {...args}>
      {/* <Image src='/assets/harmony.svg' /> */}
      <Row justify='center'>
        <SiderLink href='https://harmony.one/'>
          <Image preview={false} src={isMobile ? HarmonyIcon : HarmonyLogo} style={{ cursor: 'pointer', padding: isMobile ? 16 : 32 }} onClick={() => history.push('/')} />
        </SiderLink>
      </Row>
      {!isMobile && <Row justify='center' style={{ marginBottom: 24 }}><SiderLink href='https://harmony.one/1wallet'>{config.appName} {config.version}</SiderLink></Row>}

      {!isMobile && <LineDivider>Global Usage</LineDivider>}

      {!isMobile && stats &&
        <Row style={{ marginBottom: 16 }} justify='center'>
          <Row style={{ marginBottom: 8 }}>
            <Tag color='dimgray' style={{ margin: 0, width: 64, borderRadius: 0, textAlign: 'center' }}>wallets</Tag>
            <Tag color='lightseagreen' style={{ width: 80, borderRadius: 0, textAlign: 'center' }}>{stats.count.toLocaleString()}</Tag>
          </Row>
          <Row>
            <Tag color='dimgray' style={{ margin: 0, width: 64, borderRadius: 0, textAlign: 'center' }}>balance</Tag>
            <Tag color='steelblue' style={{ width: 80, borderRadius: 0, textAlign: 'center' }}>{stats.totalAmount.toLocaleString()} ONE</Tag>
          </Row>
        </Row>}

      {!isMobile && <LineDivider />}

      <Menu theme='dark' mode='inline' onClick={nav} selectedKeys={[action]}>
        <Menu.Item key='create' icon={<PlusCircleOutlined />}>Create</Menu.Item>
        <Menu.Item key='wallets' icon={<UnorderedListOutlined />}>Wallets</Menu.Item>
        <Menu.Item key='restore' icon={<HistoryOutlined />}>Restore</Menu.Item>
      </Menu>
      <LineDivider />
      <Menu theme='dark' mode='inline' selectable={false}>
        <Menu.Item key='bug' icon={<GithubOutlined />}><SiderLink style={{ color: null }} href='https://github.com/polymorpher/one-wallet/issues'>Bug Report</SiderLink></Menu.Item>
        <Menu.Item key='audit' icon={<AuditOutlined />}><SiderLink style={{ color: null }} href='https://github.com/polymorpher/one-wallet/tree/master/audits'>Audits</SiderLink></Menu.Item>
        <Menu.Item key='wiki' icon={<InfoCircleOutlined />}><SiderLink style={{ color: null }} href='https://github.com/polymorpher/one-wallet/wiki'>Wiki</SiderLink></Menu.Item>
      </Menu>

    </Layout.Sider>
  )
}

export default SiderMenu
