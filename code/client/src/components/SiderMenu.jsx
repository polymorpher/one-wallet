import React from 'react'
import { useHistory, useRouteMatch } from 'react-router'
import Paths from '../constants/paths'
import util, { useWindowDimensions } from '../util'
import { useDispatch, useSelector } from 'react-redux'
import { globalActions } from '../state/modules/global'
import MobileSiderMenuV2 from './SiderMenu/MobileSiderMenuV2'
import { DeskstopSiderMenuV2 } from './SiderMenu/DesktopSiderMenuV2'
import { DeskstopSiderMenu } from './SiderMenu/DeskstopSiderMenu'
import { MobileSiderMenu } from './SiderMenu/MobileSiderMenu'

const SiderMenu = ({ ...args }) => {
  const { isMobile } = useWindowDimensions()
  const history = useHistory()
  const match = useRouteMatch('/:action')
  const { action } = match ? match.params : {}
  args.action = action
  args.nav = ({ key }) => {
    history.push(Paths[key])
  }

  return isMobile
    ? <MobileSiderMenu {...args} />
    : <DeskstopSiderMenu {...args} />
}

export const SiderMenuV2 = ({ ...args }) => {
  const history = useHistory()
  const dispatch = useDispatch()
  const { isMobile } = useWindowDimensions()
  const wallets = useSelector(state => state.wallet)
  const selectedAddress = useSelector(state => state.global.selectedWallet)
  const network = useSelector(state => state.global.network)
  const networkWallets = util.filterNetworkWallets(wallets, network)
  const matchedWallet = networkWallets.filter(w => w.address === selectedAddress)[0]

  args.nav = ({ key }) => {
    if (key.startsWith('wallet')) {
      // If no matched wallet, default to select the first if exists.
      if (!matchedWallet && networkWallets[0]) {
        dispatch(globalActions.selectWallet(networkWallets[0].address))
      }
      const matchedOrFirstWallet = matchedWallet ?? networkWallets[0]

      if (matchedOrFirstWallet) {
        const [, action] = key.split('/')
        history.push(Paths.showAddress(matchedOrFirstWallet.address, action))
      } else {
        history.push(Paths.create)
      }
    } else if (key.startsWith('internal')) {
      const [, action] = key.split('/')
      history.push(Paths[action])
    }
  }

  return isMobile
    ? <MobileSiderMenuV2 {...args} />
    : <DeskstopSiderMenuV2 {...args} />
}

export default SiderMenu
