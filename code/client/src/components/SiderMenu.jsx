import React from 'react'
import { useHistory, useRouteMatch } from 'react-router'
import { Layout, Image, Menu } from 'antd'
import { PlusCircleOutlined, UnorderedListOutlined, HistoryOutlined } from '@ant-design/icons'
import HarmonyLogo from '../assets/harmony.svg'
import config from '../config'
import Paths from '../constants/paths'
import styled from 'styled-components'

const Text = styled.p`
  color: #fafafa;
  text-align: center;
  margin-bottom: 32px;
`

const SiderMenu = ({ ...args }) => {
  const history = useHistory()
  const match = useRouteMatch('/:action')
  const { action } = match.params
  const nav = ({ key }) => {
    history.push(Paths[key])
  }
  return (
    <Layout.Sider {...args}>
      {/* <Image src='/assets/harmony.svg' /> */}
      <Image preview={false} src={HarmonyLogo} style={{ padding: 32 }} />
      <Text>{config.appName} {config.version}</Text>
      <Menu theme='dark' mode='inline' onClick={nav} selectedKeys={[action]}>
        <Menu.Item key='create' icon={<PlusCircleOutlined />}>Create</Menu.Item>
        <Menu.Item key='wallets' icon={<UnorderedListOutlined />}>Wallets</Menu.Item>
        <Menu.Item key='restore' icon={<HistoryOutlined />}>Restore</Menu.Item>
      </Menu>

    </Layout.Sider>
  )
}

export default SiderMenu
