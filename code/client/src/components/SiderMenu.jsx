import React from 'react'
import { Layout, Image, Menu } from 'antd'
import { PlusCircleOutlined, UnorderedListOutlined, HistoryOutlined } from '@ant-design/icons'
import HarmonyLogo from '../assets/harmony.svg'

const SiderMenu = () => {
  return (
    <Layout.Sider>
      {/* <Image src='/assets/harmony.svg' /> */}
      <Image src={HarmonyLogo} />
      <Menu theme='dark' mode='inline' defaultSelectedKeys={['1']}>
        <Menu.Item key='1' icon={PlusCircleOutlined}>Create</Menu.Item>
        <Menu.Item key='2' icon={UnorderedListOutlined}>List</Menu.Item>
        <Menu.Item key='3' icon={HistoryOutlined}>Restore</Menu.Item>
      </Menu>

    </Layout.Sider>
  )
}

export default SiderMenu
