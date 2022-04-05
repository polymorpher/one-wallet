import React, { useState, useEffect } from 'react'
import Row from 'antd/es/row'
import Divider from 'antd/es/divider'
import Tag from 'antd/es/tag'
import Spin from 'antd/es/spin'
import abbr from '../abbr'
import { useDispatch, useSelector } from 'react-redux'
import { getPrimaryBorderColor } from '../theme'
import WalletConstants from '../constants/wallet'
import { cacheActions } from '../state/modules/cache'

export const LineDivider = ({ children }) => {
  const theme = useSelector(state => state.global.v2ui ? state.global.theme : 'dark')
  const color = getPrimaryBorderColor(theme)
  return (
    <Divider style={{ borderColor: color, opacity: 0.5, color: color, fontSize: 14 }}>
      {children}
    </Divider>
  )
}

export const StatsInfo = () => {
  const statsCached = useSelector(state => state.cache.global.stats)
  const [stats, setStats] = useState(null)
  const dispatch = useDispatch()

  useEffect(() => {
    setStats(statsCached)
  }, [statsCached])

  useEffect(() => {
    const { timeUpdated } = statsCached || {}
    if (!timeUpdated || (Date.now() - timeUpdated > WalletConstants.globalStatsCacheDuration)) {
      dispatch(cacheActions.fetchGlobalStats())
    } else {
      setStats(statsCached)
    }
  }, [])

  return (
    <>
      <LineDivider>Global Usage</LineDivider>
      {stats
        ? (
          <Row style={{ marginBottom: 16 }} justify='center'>
            <Row style={{ marginBottom: 8 }}>
              <Tag color='dimgray' style={{ margin: 0, width: 64, borderRadius: 0, textAlign: 'center' }}>wallets</Tag>
              <Tag color='lightseagreen' style={{ width: 80, borderRadius: 0, textAlign: 'center' }}>{stats.count.toLocaleString()}</Tag>
            </Row>
            <Row>
              <Tag color='dimgray' style={{ margin: 0, width: 64, borderRadius: 0, textAlign: 'center' }}>balance</Tag>
              <Tag color='steelblue' style={{ width: 80, borderRadius: 0, textAlign: 'center' }}>{abbr(stats.totalAmount, 0)} ONE</Tag>
            </Row>
          </Row>)
        : (
          <Row justify='center'>
            <Spin />
          </Row>)}
      <LineDivider />
    </>
  )
}
