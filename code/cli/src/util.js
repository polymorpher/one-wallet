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
    majorVersion,
    minorVersion
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
    'Major Version': majorVersion,
    'Minor Version': minorVersion,
  }
}

// TODO: merge with client function
export const validBalance = (balance, allowFloat) => {
  if (typeof balance === 'number') { return true }
  if (typeof balance !== 'string') { return false }
  for (let i = 0; i < balance.length; i += 1) {
    const c = balance.charCodeAt(i)
    if (c < 48 || c > 57) {
      if (!allowFloat) {
        return false
      }
      if (c !== 46) {
        return false
      }
    }
  }
  return true
}

// TODO: merge with client function
export const formatNumber = (number, maxPrecision) => {
  maxPrecision = maxPrecision || 4
  number = parseFloat(number)
  if (number < 10 ** (-maxPrecision)) {
    return '0'
  }
  const order = Math.ceil(Math.log10(Math.max(number, 1)))
  const digits = Math.max(0, maxPrecision - order)
  return number.toFixed(digits)
}

// TODO: merge with client function
export const computeBalance = (balance, price) => {
  if (!validBalance(balance)) {
    return { balance: 0, formatted: '0', fiat: 0, fiatFormatted: '0', valid: false }
  }
  const ones = ONEUtil.toOne(balance || 0)
  const formatted = formatNumber(ones)
  const fiat = (price || 0) * parseFloat(ones)
  const fiatFormatted = formatNumber(fiat)
  return { balance, formatted, fiat, fiatFormatted, valid: true }
}

// TODO: merge with client function
export const toBalance = (formatted, price) => {
  if (!validBalance(formatted, true)) {
    return { balance: 0, formatted: '0', fiat: 0, fiatFormatted: '0', valid: false }
  }
  const f = parseFloat(formatted)
  const balance = ONEUtil.toFraction(f)
  const fiat = f * (price || 0)
  const fiatFormatted = formatNumber(fiat)
  return { balance, formatted, fiat, fiatFormatted, valid: true }
}
