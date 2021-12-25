import message from '../message'
import { MigrationPayload } from '../proto/oauthMigration'
import { Image, Row } from 'antd'
import util, { OSType } from '../util'
import React from 'react'
import config from '../config'
import ONEUtil from '../../../lib/util'
const OAUTH_OTP_PATTERN = /otpauth:\/\/totp\/([a-zA-Z0-9]+)(%3A|:)(.+)\?.+/
export const parseOAuthOTP = (url) => {
  // console.log(url)
  const m = url.match(OAUTH_OTP_PATTERN)
  if (!m) {
    message.error('Invalid account transfer QR code')
    return null
  }
  try {
    const parsedUrl = new URL(url)
    const secret = parsedUrl.searchParams.get('secret')
    const issuer2 = parsedUrl.searchParams.get('issuer')
    const issuer = m[1] || issuer2
    if (issuer !== 'ONE Wallet' && issuer !== 'Harmony' && issuer !== '1wallet') {
      message.error('Invalid issuer of the recovery QR code. Expecting `1wallet` or `Harmony`')
      return null
    }
    // return { name: decodeURIComponent(m[3]), secret }
    return { name: decodeURIComponent(m[3]), secret: ONEUtil.processOtpSeed(secret) }
  } catch (ex) {
    message.error('Unable to parse URL contained in QR code')
    console.error(ex)
    return null
  }
}
export const parseMigrationPayload = url => {
  const data = new URL(url).searchParams.get('data')
  const decoded = MigrationPayload.decode(Buffer.from(data, 'base64'))
  // console.log(decoded)
  const params = decoded.otpParameters
  const filteredParams = params.filter(e => e.issuer === 'ONE Wallet' || e.issuer === 'Harmony')
  if (filteredParams.length > 2) {
    message.error('You selected too many accounts to export. Please pick one account only.')
    return null
  }
  let secret2
  if (filteredParams.length === 2) {
    const names = filteredParams.map(e => e.name.split(' -')[0].trim()).map(e => e.split('(')[0].trim())
    if (names[0] !== names[1]) {
      message.error('You selected two 1wallets with different names. If you want to select two entries belonging to the same wallet, make sure they have the same name and the second one has "- 2nd" in the end')
      return undefined
    }
    secret2 = new Uint8Array(filteredParams[1]?.secret)
    // secret2 = ONEUtil.base32Encode(filteredParams[1]?.secret)
  }
  const secret = new Uint8Array(filteredParams[0]?.secret)
  // const secret = ONEUtil.base32Encode(filteredParams[0]?.secret)
  // console.log(secret.constructor.name)
  const name = filteredParams[0]?.name
  return { secret, secret2, name }
}

export const OTPUriMode = {
  STANDARD: 0,
  MIGRATION: 1,
  TOTP: 2, // seems deprecated, should not use unless it is for testing
}

export const getQRCodeUri = (otpSeed, otpDisplayName, mode = OTPUriMode.STANDARD) => {
  if (mode === OTPUriMode.STANDARD) {
    // otpauth://TYPE/LABEL?PARAMETERS
    return `otpauth://totp/${otpDisplayName}?secret=${ONEUtil.base32Encode(otpSeed)}&issuer=Harmony`
  }
  if (mode === OTPUriMode.MIGRATION) {
    const payload = MigrationPayload.create({
      otpParameters: [{
        issuer: 'Harmony',
        secret: otpSeed,
        name: otpDisplayName,
        algorithm: MigrationPayload.Algorithm.ALGORITHM_SHA1,
        digits: MigrationPayload.DigitCount.DIGIT_COUNT_SIX,
        type: MigrationPayload.OtpType.OTP_TYPE_TOTP,
      }],
      version: 1,
      batchIndex: 0,
      batchSize: 1,
    })
    const bytes = MigrationPayload.encode(payload).finish()
    const b64 = Buffer.from(bytes).toString('base64')
    // console.log({ payload, bytes, b64 })
    return `otpauth-migration://offline?data=${encodeURIComponent(b64)}`
  }
  return null
}

// not constructing qrCodeData on the fly (from seed) because generating a PNG takes noticeable amount of time. Caller needs to make sure qrCodeData is consistent with seed
export const buildQRCodeComponent = ({ seed, name, os, isMobile, qrCodeData }) => {
  const image = (url) =>
    <Image
      src={qrCodeData}
      preview={false}
      width={isMobile ? 192 : 256}
      style={isMobile && { border: '1px solid lightgrey', borderRadius: 8, boxShadow: '0px 0px 10px lightgrey' }}
      onClick={url && (() => window.open(url, '_self').focus())}
    />
  let href
  if (os === OSType.iOS) {
    href = getQRCodeUri(seed, name, OTPUriMode.MIGRATION)
  } else if (os === OSType.Android) {
    href = getQRCodeUri(seed, name, OTPUriMode.STANDARD)
  } else if (isMobile) {
    // To test in more devices
    href = getQRCodeUri(seed, name, OTPUriMode.MIGRATION)
  }

  return (
    <Row justify='center'>
      {isMobile && qrCodeData && image(href)}
      {!isMobile && qrCodeData && image()}
    </Row>
  )
}

export const getSecondCodeName = (name) => `${name} - 2nd`

export const NAME_ADDRESS_COMBINED_PATTERN = /([A-Za-z ]+)([0-9\- :]+)\[([a-z0-9]+)\]/

// input is assumed to be already gone through decodeURIComponent
export const parseAuthAccountName = (rawName) => {
  if (rawName.indexOf('[') > 0) {
    const m = rawName.match(NAME_ADDRESS_COMBINED_PATTERN)
    if (!m) {
      return null
    }
    return { name: m[1].trim(), time: m[2].trim(), address: m[3].trim() }
  }
  return { name: rawName.trim() }
}
