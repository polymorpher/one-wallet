import { getColorPalette, useTheme } from '../../theme'
import { useRouteMatch } from 'react-router'
import Paths from '../../constants/paths'
import Menu from 'antd/es/menu'
import OverviewIcon from '../../assets/icons/overview.svg'
import AssetsIcon from '../../assets/icons/assets.svg'
import NFTIcon from '../../assets/icons/nft.svg'
import SwapIcon from '../../assets/icons/swap.svg'
import StakeIcon from '../../assets/icons/stake.svg'
import RestoreIcon from '../../assets/icons/restore.svg'
import { SiderLink } from '../Text'
import React from 'react'
import { RouteActionMap } from './Common'

const MobileSiderMenuV2 = ({ nav, ...args }) => {
  const theme = useTheme()
  const { secondaryTextColor } = getColorPalette(theme)
  const match = useRouteMatch(Paths.matchStructure)
  const { category, section } = match ? match.params : {}
  const action = RouteActionMap[section] ?? RouteActionMap[category]

  return (
    <Menu
      theme={theme}
      mode='horizontal'
      onClick={nav}
      selectedKeys={[action]}
    >
      {[
        { key: RouteActionMap.show, IconEl: OverviewIcon, label: 'Overview' },
        { key: RouteActionMap.assets, IconEl: AssetsIcon, label: 'Assets' },
        { key: RouteActionMap.nft, IconEl: NFTIcon, label: 'NFTs' },
        { key: RouteActionMap.swap, IconEl: SwapIcon, label: 'Swap' },
        { key: RouteActionMap.stake, IconEl: StakeIcon, label: 'Stake' },
        { key: RouteActionMap.restore, IconEl: RestoreIcon, label: 'Restore' },
      ].map(({ key, IconEl, label }) => <Menu.Item key={key} style={{ display: 'flex', alignItems: 'center' }} icon={<IconEl fill={action === 'overview' ? 'currentColor' : secondaryTextColor} />}>{label}</Menu.Item>)}
      <Menu.Item key='external/grant'><SiderLink href='https://harmony.one/wallet'>Grants</SiderLink></Menu.Item>
      <Menu.Item key='external/audit'><SiderLink href='https://github.com/polymorpher/one-wallet/tree/master/audits'>Audits</SiderLink></Menu.Item>
      <Menu.Item key='external/wiki'><SiderLink href='https://github.com/polymorpher/one-wallet/wiki'>Wiki</SiderLink></Menu.Item>
      <Menu.Item key='external/bug'><SiderLink href='https://github.com/polymorpher/one-wallet/issues'>Bugs</SiderLink></Menu.Item>
      <Menu.Item key='external/network'><SiderLink href='https://github.com/polymorpher/one-wallet/issues'>Network</SiderLink></Menu.Item>
      <Menu.Item key='internal/tools'>Tools</Menu.Item>
    </Menu>
  )
}

export default MobileSiderMenuV2
