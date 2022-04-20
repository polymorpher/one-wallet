import React, { useState, useEffect } from 'react'
import Row from 'antd/es/row'
import Divider from 'antd/es/divider'
import Tag from 'antd/es/tag'
import Statistic from 'antd/es/statistic'
import Spin from 'antd/es/spin'
import abbr from '../abbr'
import { useDispatch, useSelector } from 'react-redux'
import { getColorPalette, useTheme } from '../theme'
import WalletConstants from '../constants/wallet'
import { cacheActions } from '../state/modules/cache'

export const LineDivider = ({ children }) => {
  const theme = useTheme()
  const { primaryBorderColor: color } = getColorPalette(theme)
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
            <Row style={{ lineHeight: 15 }}>
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

export const StatsInfoV2 = () => {
  const statsCached = useSelector(state => state.cache.global.stats)
  const onePrice = useSelector(state => state.global.price)
  const [stats, setStats] = useState(null)
  const dispatch = useDispatch()
  const theme = useTheme()
  const { primaryTextColor, secondaryBgColor } = getColorPalette(theme)

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
    stats
      ? (
        <Row style={{ color: primaryTextColor }} justify='center' className='wallet-stats-info'>
          <Tag color={secondaryBgColor} style={{ margin: 0, padding: '4px 24px' }}>
            <Statistic style={{ lineHeight: '16px' }} title='ONE price' value={onePrice} prefix='$' valueStyle={{ color: primaryTextColor, fontWeight: 'bold' }} />
          </Tag>
          <Tag color={secondaryBgColor} style={{ margin: '0 -1px', padding: '4px 24px' }}>
            <Statistic style={{ lineHeight: '16px' }} title='1Wallet count' value={stats.count} valueStyle={{ color: primaryTextColor, fontWeight: 'bold' }} />
          </Tag>
          <Tag color={secondaryBgColor} style={{ margin: 0, padding: '4px 24px' }}>
            <Statistic style={{ lineHeight: '16px' }} title='Total managed' value={(stats.totalAmount * onePrice).toFixed(2)} prefix='$' valueStyle={{ color: primaryTextColor, fontWeight: 'bold' }} />
          </Tag>
        </Row>)
      : (
        <Row justify='center'>
          <Spin />
        </Row>)
  )
}
