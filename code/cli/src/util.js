import { HarmonyAddress } from '@harmony-js/crypto'
import Constants from './constants'
import ONEUtil from '../../lib/util'
import humanizeDuration from 'humanize-duration'

export const stringify = wallet => {
  const {
    name,
    address,
    root,
    duration,
    slotSize,
    effectiveTime,
    lastResortAddress,
    dailyLimit,
    hseed,
    network,
  } = wallet
  const oneAddress = new HarmonyAddress(address).bech32
  const oneLastResortAddress = new HarmonyAddress(address).bech32
  const expirationDuration = effectiveTime + duration - Date.now()
  return {
    Name: name,
    'Wallet Network': network,
    'Wallet Address': oneAddress,
    'Wallet Address (Hex)': address,
    'Recovery Address': oneLastResortAddress,
    'Recovery Address (Hex)': lastResortAddress,
    'Root Identifier': '0x' + root,
    'Transaction Limit': slotSize + ` per ${Constants.interval / 1000} seconds`,
    'Creation Time': new Date(effectiveTime).toLocaleString(),
    'Daily Spending Limit': ONEUtil.toOne(dailyLimit) + ' ONE',
    'Expiration Time': humanizeDuration(expirationDuration, { units: ['y', 'mo', 'd'], round: true }) + ' from now',
    Salt: hseed,
  }
}
