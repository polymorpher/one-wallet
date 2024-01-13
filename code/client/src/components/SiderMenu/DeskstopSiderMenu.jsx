import Layout from 'antd/es/layout'
import Row from 'antd/es/row'
import { SiderLink } from '../Text'
import config from '../../config'
import Image from 'antd/es/image'
import { Logo } from './Common'
import { LineDivider, StatsInfo } from '../StatsInfo'
import Menu from 'antd/es/menu'
import PlusCircleOutlined from '@ant-design/icons/PlusCircleOutlined'
import UnorderedListOutlined from '@ant-design/icons/UnorderedListOutlined'
import HistoryOutlined from '@ant-design/icons/HistoryOutlined'
import { CloudOutlined, ContactsOutlined, WalletOutlined } from '@ant-design/icons'
import GithubOutlined from '@ant-design/icons/GithubOutlined'
import AuditOutlined from '@ant-design/icons/AuditOutlined'
import InfoCircleOutlined from '@ant-design/icons/InfoCircleOutlined'
import ToolOutlined from '@ant-design/icons/ToolOutlined'
import React from 'react'

export const DeskstopSiderMenu = ({ action, nav, ...args }) => {
  return (
    <Layout.Sider collapsed={false} {...args} theme='dark'>
      {/* <Image src='/assets/harmony.svg' /> */}
      <Row justify='center'>
        <SiderLink href={config.logoLink}>
          <Image preview={false} src={Logo} style={{ cursor: 'pointer', padding: 32 }} />
        </SiderLink>
      </Row>

      <Row justify='center' style={{ marginBottom: 24 }}><SiderLink style={{ color: 'white' }} href={config.appLink}>{config.appName} {config.version}</SiderLink></Row>

      <StatsInfo />

      <Menu theme='dark' mode='inline' onClick={nav} selectedKeys={[action]}>
        <Menu.Item key='create' icon={<PlusCircleOutlined />}>Create</Menu.Item>
        <Menu.Item key='wallets' icon={<UnorderedListOutlined />}>Wallets</Menu.Item>
        <Menu.Item key='restore' icon={<HistoryOutlined />}>Restore</Menu.Item>
        <Menu.Item key='backup' icon={<CloudOutlined />}>Backup</Menu.Item>
        <Menu.Item key='contacts' icon={<ContactsOutlined />}>Contacts</Menu.Item>
      </Menu>
      <LineDivider />
      <Menu theme='dark' mode='inline' selectable={false}>
        <Menu.Item key='pro' icon={<WalletOutlined />}><SiderLink style={{ color: null }} href='https://modulo.so'>About Modulo</SiderLink></Menu.Item>
        <Menu.Item key='bug' icon={<GithubOutlined />}><SiderLink style={{ color: null }} href='https://github.com/polymorpher/one-wallet/issues'>Bug Report</SiderLink></Menu.Item>
        <Menu.Item key='audit' icon={<AuditOutlined />}><SiderLink style={{ color: null }} href='https://github.com/polymorpher/one-wallet/tree/master/audits'>Audits</SiderLink></Menu.Item>
        <Menu.Item key='wiki' icon={<InfoCircleOutlined />}><SiderLink style={{ color: null }} href='https://github.com/polymorpher/one-wallet/wiki'>Wiki</SiderLink></Menu.Item>
      </Menu>
      <LineDivider />
      <Menu theme='dark' mode='inline' onClick={nav} selectedKeys={[action]}>
        <Menu.Item key='tools' icon={<ToolOutlined />}>Tools</Menu.Item>
      </Menu>
    </Layout.Sider>
  )
}
