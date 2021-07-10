import { useState, useEffect } from 'react'
import { HarmonyAddress } from '@harmony-js/crypto'
import { isInteger, values } from 'lodash'
import ONEUtil from '../../lib/util'
import { AddressError } from './constants/errors'
import config from './config'

export default {
  formatNumber: (number, maxPrecision) => {
    maxPrecision = maxPrecision || 4
    number = parseFloat(number)
    if (number < 10 ** (-maxPrecision)) {
      return '0'
    }
    const order = Math.ceil(Math.log10(Math.max(number, 1)))
    const digits = Math.max(0, maxPrecision - order)
    return number.toFixed(digits)
  },

  ellipsisAddress: (address) => {
    if (!address || address.length < 10) {
      return address
    }
    return address.slice(0, 6) + '...' + address.slice(address.length - 3, address.length - 1)
  },

  validBalance: (balance, allowFloat) => {
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
  },

  toBalance: (formatted, price) => {
    if (!exports.default.validBalance(formatted, true)) {
      return { balance: 0, formatted: '0', fiat: 0, fiatFormatted: '0', valid: false }
    }
    const f = parseFloat(formatted)
    const balance = ONEUtil.toFraction(f)
    const fiat = f * (price || 0)
    const fiatFormatted = exports.default.formatNumber(fiat)
    return { balance, formatted, fiat, fiatFormatted, valid: true }
  },

  computeBalance: (balance, price) => {
    if (!exports.default.validBalance(balance)) {
      return { balance: 0, formatted: '0', fiat: 0, fiatFormatted: '0', valid: false }
    }
    const ones = ONEUtil.toOne(balance || 0)
    const formatted = exports.default.formatNumber(ones)
    const fiat = (price || 0) * parseFloat(ones)
    const fiatFormatted = exports.default.formatNumber(fiat)
    return { balance, formatted, fiat, fiatFormatted, valid: true }
  },

  normalizedAddress: (address) => {
    try {
      address = new HarmonyAddress(address).checksum
    } catch (ex) {
      const err = (address.startsWith('one') && AddressError.InvalidBech32Address(ex)) ||
        (address.startsWith('0x') && AddressError.InvalidHexAddress(ex)) || AddressError.Unknown(ex)
      if (err) {
        throw err
      }
    }
    return address
  },

  safeNormalizedAddress: (address, trace) => {
    try {
      return exports.default.normalizedAddress(address)
    } catch (ex) {
      trace && console.trace(ex)
      return null
    }
  },

  oneAddress: (address) => {
    return new HarmonyAddress(address).bech32
  },

  safeOneAddress: (address, trace) => {
    try {
      return exports.default.oneAddress(address)
    } catch (ex) {
      trace && console.trace(ex)
      return null
    }
  },

  isEmptyAddress: (address) => {
    return address === '0x0000000000000000000000000000000000000000' || address === 'one1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqquzw7vz'
  },

  safeExec: (f, args, handler) => {
    if (typeof f !== 'function') {
      return f
    }
    try {
      return f(...args)
    } catch (ex) {
      handler && handler(ex)
    }
  },

  filterNetworkWallets: (wallets, network) => {
    return values(wallets).filter(w => w.network === network)
  },

  getNetworkExplorerUrl: (wallet) => {
    if (wallet.network === 'harmony-testnet') {
      return `https://explorer.pops.one/#/address/${wallet.address}`
    }

    return `https://explorer.harmony.one/#/address/${wallet.address}`
  },

  isWalletOutdated: (wallet) => {
    return !wallet.majorVersion || !(wallet.majorVersion >= config.minWalletVersion)
  },

  parseOtp: otpInput => {
    const parsedOtp = parseInt(otpInput)
    if (!isInteger(parsedOtp) || !(parsedOtp < 1000000)) {
      return null
    }
    return parsedOtp
  }
}

function getWindowDimensions () {
  const { innerWidth: width, innerHeight: height } = window
  return {
    width,
    height
  }
}

export function useWindowDimensions () {
  const [windowDimensions, setWindowDimensions] = useState(getWindowDimensions())

  useEffect(() => {
    function handleResize () {
      setWindowDimensions(getWindowDimensions())
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return windowDimensions
}
