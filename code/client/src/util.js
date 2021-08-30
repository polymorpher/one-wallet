import { useState, useEffect } from 'react'
import { HarmonyAddress } from '@harmony-js/crypto'
import { isInteger, values } from 'lodash'
import ONEUtil from '../../lib/util'
import ONEConstants from '../../lib/constants'
import { AddressError } from './constants/errors'
import config from './config'

export default {
  // TODO: rewrite using BN to achieve 100% precision
  formatNumber: (number, maxPrecision) => {
    maxPrecision = maxPrecision || 4
    number = parseFloat(number)
    if (number < 10 ** (-maxPrecision)) {
      return '0'
    }
    const order = Math.ceil(Math.log10(Math.max(number, 1)))
    const digits = Math.max(0, maxPrecision - order)
    // https://www.jacklmoore.com/notes/rounding-in-javascript/
    const floored = Number(`${Math.floor(`${number}e+${digits}`)}e-${digits}`)
    return floored.toString()
  },

  ellipsisAddress: (address) => {
    if (!address || address.length < 10) {
      return address
    }
    return address.slice(0, 6) + '...' + address.slice(address.length - 3, address.length)
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

  toBalance: (formatted, price, decimals) => {
    if (!exports.default.validBalance(formatted, true)) {
      return { balance: 0, formatted: '0', fiat: 0, fiatFormatted: '0', valid: false }
    }
    const f = parseFloat(formatted)
    const balance = ONEUtil.toFraction(f, null, decimals)
    const fiat = f * (price || 0)
    const fiatFormatted = exports.default.formatNumber(fiat)
    return { balance, formatted, fiat, fiatFormatted, valid: true }
  },

  computeBalance: (balance, price, decimals) => {
    if (!exports.default.validBalance(balance)) {
      return { balance: 0, formatted: '0', fiat: 0, fiatFormatted: '0', valid: false }
    }
    const ones = ONEUtil.toOne(balance || 0, null, decimals)
    const formatted = exports.default.formatNumber(ones)
    const fiat = (price || 0) * parseFloat(ones)
    const fiatFormatted = exports.default.formatNumber(fiat)
    return { balance, formatted, fiat, fiatFormatted, valid: true }
  },

  normalizedAddress: (address) => {
    if (!address) {
      return
    }
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
    return !address || address === ONEConstants.EmptyAddress || address === ONEConstants.EmptyBech32Address
  },

  isRecoveryAddressSet: address => {
    return !exports.default.isEmptyAddress(address) && address !== ONEConstants.TreasuryAddress
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

  getNetworkExplorerUrl: (address, network) => {
    if (network === 'harmony-testnet') {
      return `https://explorer.pops.one/#/address/${address}`
    }

    return `https://explorer.harmony.one/#/address/${address}`
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
  },

  isNFT: token => {
    if (!token) {
      return false
    }
    return token.tokenType === ONEConstants.TokenType.ERC721 || token.tokenType === ONEConstants.TokenType.ERC1155
  },

  replaceIPFSLink: link => {
    if (!link || !link.startsWith('ipfs://')) {
      return link
    }
    let end = link.indexOf('?')
    if (end < 0) {
      end = link.length
    }
    const hash = link.slice(7, end)
    return config.ipfs.gateway.replace('{{hash}}', hash)
  },

  isNonZeroBalance: balance => {
    return balance && balance !== '0'
  },

  canWalletSupportToken: wallet => {
    if (wallet.majorVersion > 5) {
      return true
    }
    if (wallet.majorVersion === 5) {
      if (wallet.minorVersion >= 3 || config.debug) {
        return true
      }
    }
    return false
  },

  compareVersion: (left, right) => left.majorVersion === right.majorVersion && left.minorVersion === right.minorVersion,

  getRandomness: () => {
    let r = config.clientSecurity.baseRandomness - config.clientSecurity.randomnessDamping
    if (config.clientSecurity.hasher === 'argon2') {
      r -= config.clientSecurity.argon2Damping
    }
    return r
  },

  /**
   * Shorten wallet address if the wallet has long name or the current view is mobile.
   * We consider label with more than 6 characters as long address label.
   * Domain name can be used as label.
   */
  shouldShortenAddress: ({ label, isMobile }) =>
    label && label.length > 6 || isMobile,

  getTextWidth: (text, font, ref) => {
    // console.log(ref)
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    const style = font || getComputedStyle(ref || document.body)
    const { fontSize, fontFamily } = style
    context.font = `${fontSize} ${fontFamily}`
    const w = context.measureText(text).width
    // console.log(w, context.font)
    return w
  },

  releaseNotesUrl: ({ majorVersion, minorVersion }) => {
    return `https://github.com/polymorpher/one-wallet/wiki/Release-Notes#v${majorVersion}.${minorVersion}`
  },
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
  const isMobile = !(windowDimensions.width >= 992)

  useEffect(() => {
    function handleResize () {
      setWindowDimensions(getWindowDimensions())
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return { isMobile, ...windowDimensions }
}

/**
 * Custom hook that executes a function with delay and cancellation, if the useEffect is destroyed due to the dependencies
 * update, the timeout is cancelled, which cancels the function execution.
 * The function only runs when the supplied condition is true.
 */
export const useWaitExecution = (func, runCondition, wait, dependencies) => {
  useEffect(() => {
    let timeout
    if (runCondition) {
      timeout = setTimeout(func, wait)
    }

    return () => {
      clearTimeout(timeout)
    }
  }, dependencies)
}
