import { useState, useEffect } from 'react'
import { HarmonyAddress } from '@harmony-js/crypto'
import isInteger from 'lodash/fp/isInteger'
import values from 'lodash/fp/values'
import ONEUtil from '../../lib/util'
import ONEConstants from '../../lib/constants'
import { AddressError } from './constants/errors'
import WalletConstants from './constants/wallet'
import BN from 'bn.js'
import config from './config'
import ONENames from '../../lib/names'

const util = {
  // TODO: rewrite using BN to achieve 100% precision
  formatNumber: ONEUtil.formatNumber,

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

  toBalance: (formatted, price, decimals, maxPrecision) => {
    if (!exports.default.validBalance(formatted, true)) {
      return { balance: 0, formatted: '0', fiat: 0, fiatFormatted: '0', valid: false }
    }
    const balance = ONEUtil.toFraction(formatted, null, decimals)
    let fiat, fiatFormatted
    if (price !== undefined && price !== null) {
      const f = parseFloat(formatted)
      fiat = f * (price || 0)
      fiatFormatted = exports.default.formatNumber(fiat, maxPrecision)
    }
    return { balance, formatted, fiat, fiatFormatted, valid: true }
  },

  computeBalance: (balance, price, decimals, maxPrecision) => {
    if (!exports.default.validBalance(balance)) {
      return { balance: 0, formatted: '0', fiat: 0, fiatFormatted: '0', valid: false }
    }
    const ones = ONEUtil.toOne(balance || 0, null, decimals)
    const formatted = exports.default.formatNumber(ones, maxPrecision)
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

  isDefaultRecoveryAddress: address => {
    return address === ONEConstants.TreasuryAddress || ONEConstants.OldTreasuryAddresses.includes(address)
  },

  isBlacklistedAddress: address => {
    return ONEConstants.BlacklistedAddresses.includes(address)
  },

  isRecoveryAddressSet: address => {
    return !exports.default.isEmptyAddress(address) && !exports.default.isDefaultRecoveryAddress(address)
  },

  canRenew: ({ effectiveTime, duration }) => {
    // return duration + effectiveTime - Date.now() < WalletConstants.expiringSoonThreshold
    return Date.now() - effectiveTime > 3600 * 24 * 1000 * 14 // for testing
    // return Date.now() - effectiveTime > 5 * 60 * 1000 // for testing
  },

  isValidWallet: w => {
    return w && w.root && w.address
  },

  isUpgradedFrom: (w, from) => {
    return w && w.address && (!from || w.backlinks?.includes(from)) && util.isEmptyAddress(w.forwardAddress) && !w.temp
  },

  isCommandOnlyWallet: (w) => {
    return w && !util.isEmptyAddress(w.forwardAddress) && w.majorVersion >= 16
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

  /**
   *
   * @param {string} otpInput
   * @returns {null|number}
   */
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

  replaceIPFSLink: (link, ipfsGateway) => {
    if (!link) {
      return link
    }
    if (link.indexOf('://') < 0) {
      return exports.default.replaceIPFSLink(`ipfs://${link}`, ipfsGateway)
    }
    if (!link.startsWith('ipfs://')) {
      return link
    }
    let end = link.indexOf('?')
    if (end < 0) {
      end = link.length
    }
    const hash = link.slice(7, end)
    // console.log({ link, ipfsGateway })
    // console.trace()
    return (ipfsGateway || config.ipfs.gateway).replace('{{hash}}', hash)
  },

  isNonZeroBalance: balance => {
    return balance && balance !== '0'
  },

  canWalletSupportToken: wallet => {
    if (!wallet) {
      return false
    }
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
    return `https://github.com/polymorpher/one-wallet/releases/tag/v0.${majorVersion}.${minorVersion}`
  },

  isWONE: (token) => token.address === ONEConstants.Sushi.WONE || token.contractAddress === ONEConstants.Sushi.WONE,

  isONE: (token) => !token.address && !token.contractAddress,

  getMaxSpending: (wallet) => {
    const {
      spendingAmount,
      lastSpendingInterval,
      spendingLimit,
      spendingInterval
    } = wallet
    const currentInterval = Math.floor(Date.now() / spendingInterval)
    if (currentInterval > lastSpendingInterval) {
      return new BN(spendingLimit)
    }
    return new BN(spendingLimit).sub(new BN(spendingAmount))
  },

  callArgs: ({ dest, amount }) => {
    return { amount, operationType: ONEConstants.OperationType.CALL, tokenType: ONEConstants.TokenType.NONE, contractAddress: dest, tokenId: 0, dest: ONEConstants.EmptyAddress }
  },

  canStake: (wallet) => {
    const { majorVersion } = wallet
    return majorVersion >= 16
  },

  isValidBech32: (address) => {
    if (address.length !== 42 || !address.startsWith('one1')) {
      return false
    }
    for (const c of WalletConstants.oneAddressExcludeCharacters) {
      if (address.indexOf(c) >= 0) {
        return false
      }
    }
    return true
  }
}

export default util

export const autoWalletNameHint = (wallet) => {
  if (!wallet) {
    return ''
  }
  if (wallet.majorVersion < 15) {
    return wallet.name
  }
  return ONENames.nameWithTime(wallet.name, wallet.effectiveTime)
}

export const updateQRCodeState = (newValue, state) => {
  if (!newValue || (newValue === state.last && (Date.now() - state.lastTime) < 5000)) {
    return false
  }
  state.last = newValue
  state.lastTime = Date.now()
  return true
}

export const generateOtpSeed = () => {
  const otpSeedBuffer = new Uint8Array(32)
  return window.crypto.getRandomValues(otpSeedBuffer)
}

export const checkCamera = async () => {
  try {
    const d = await navigator.mediaDevices.enumerateDevices()
    const cams = d.filter(e => e.kind === 'videoinput')
    return [cams.length > 0, cams]
  } catch (e) {
    return [false, []]
  }
}

export function getWindowDimensions () {
  const { innerWidth: width, innerHeight: height } = window
  return {
    width,
    height
  }
}

export function isMobile () {
  return !(getWindowDimensions().width >= 992)
}

export const OSType = {
  Unknown: 0,
  iOS: 1,
  Android: 2,
  Windows: 3,
}
function iOSDetect () {
  return [
    'iPad Simulator',
    'iPhone Simulator',
    'iPod Simulator',
    'iPad',
    'iPhone',
    'iPod'
  ].includes(navigator.platform) ||
    // iPad on iOS 13 detection
    (navigator.userAgent.includes('Mac') && 'ontouchend' in document)
}

function getMobileOS () {
  const userAgent = navigator.userAgent || navigator.vendor || window.opera
  // Windows Phone must come first because its UA also contains "Android"
  if (/windows phone/i.test(userAgent)) {
    return OSType.Windows
  }
  if (/android/i.test(userAgent)) {
    return OSType.Android
  }
  // https://stackoverflow.com/questions/9038625/detect-if-device-is-ios/9039885#9039885
  if (iOSDetect() || (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream)) {
    return OSType.iOS
  }
  return OSType.Unknown
}

export const Breakpoints = {
  LARGE: 1280,
  MOBILE: 992,
}

export function useWindowDimensions () {
  const [windowDimensions, setWindowDimensions] = useState(getWindowDimensions())
  const isMobile = !(windowDimensions.width >= Breakpoints.MOBILE)

  const os = isMobile && getMobileOS()

  useEffect(() => {
    function handleResize () {
      setWindowDimensions(getWindowDimensions())
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return { isMobile, os, ...windowDimensions }
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

export const isSafari = () => {
  const s = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
  return (!!window.safari) || s
}

if (window) {
  window.ONEWallet = window.ONEWallet || {}
  window.ONEWallet.util = util
  window.ONEWallet.ONEUtil = ONEUtil
}
