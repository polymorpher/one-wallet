import React, { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useHistory, useRouteMatch } from 'react-router'
import Paths from '../constants/paths'
import walletActions from '../state/modules/wallet/actions'
const Show = () => {
  const history = useHistory()
  const dispatch = useDispatch()
  const wallets = useSelector(state => state.wallet.wallets)
  const match = useRouteMatch(Paths.show)
  const { address } = match ? match.params : {}
  const selectedAddress = useSelector(state => state.wallet.selected)
  useEffect(() => {
    if (!wallets[address]) {
      return history.push(Paths.wallets)
    }
    if (address && (address !== selectedAddress)) {
      dispatch(walletActions.selectWallet(address))
    }
  }, [])

  return <>Show</>
}
export default Show
