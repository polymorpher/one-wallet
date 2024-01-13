import { useTheme } from '../../theme'
import Menu from 'antd/es/menu'
import { mobileMenuItemStyle } from './Common'
import PlusCircleOutlined from '@ant-design/icons/PlusCircleOutlined'
import UnorderedListOutlined from '@ant-design/icons/UnorderedListOutlined'
import HistoryOutlined from '@ant-design/icons/HistoryOutlined'
import { CloudOutlined, ContactsOutlined, WalletOutlined } from '@ant-design/icons'
import { SiderLink } from '../Text'
import GithubOutlined from '@ant-design/icons/GithubOutlined'
import AuditOutlined from '@ant-design/icons/AuditOutlined'
import InfoCircleOutlined from '@ant-design/icons/InfoCircleOutlined'
import ToolOutlined from '@ant-design/icons/ToolOutlined'
import React from 'react'

export const MobileSiderMenu = ({ action, nav, ...args }) => {
  const theme = useTheme()
  return (
    <Menu
      theme={theme}
      mode='horizontal'
      onClick={nav}
      selectedKeys={[action]}

    >
      <Menu.Item key='create' style={mobileMenuItemStyle} icon={<PlusCircleOutlined />}>Create</Menu.Item>
      <Menu.Item key='wallets' style={mobileMenuItemStyle} icon={<UnorderedListOutlined />}>Wallets</Menu.Item>
      <Menu.Item key='restore' style={mobileMenuItemStyle} icon={<HistoryOutlined />}>Restore</Menu.Item>
      <Menu.Item key='backup' style={mobileMenuItemStyle} icon={<CloudOutlined />}>Backup</Menu.Item>
      <Menu.Item key='contacts' style={mobileMenuItemStyle} icon={<ContactsOutlined />}>Contacts</Menu.Item>
      <Menu.Item key='about' style={mobileMenuItemStyle} icon={<WalletOutlined />}><SiderLink style={{ color: null }} href='https://modulo.so'>Modulo</SiderLink></Menu.Item>
      <Menu.Item key='bug' style={mobileMenuItemStyle} icon={<GithubOutlined />}><SiderLink style={{ color: null }} href='https://github.com/polymorpher/one-wallet/issues'>Bug Report</SiderLink></Menu.Item>
      <Menu.Item key='audit' style={mobileMenuItemStyle} icon={<AuditOutlined />}><SiderLink style={{ color: null }} href='https://github.com/polymorpher/one-wallet/tree/master/audits'>Audits</SiderLink></Menu.Item>
      <Menu.Item key='wiki' style={mobileMenuItemStyle} icon={<InfoCircleOutlined />}><SiderLink style={{ color: null }} href='https://github.com/polymorpher/one-wallet/wiki'>Wiki</SiderLink></Menu.Item>
      <Menu.Item key='tools' style={mobileMenuItemStyle} icon={<ToolOutlined />}>Tools</Menu.Item>
    </Menu>
  )
}
