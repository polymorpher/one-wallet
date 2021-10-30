import message from '../message'
import { MigrationPayload } from '../proto/oauthMigration'

const OAUTH_OTP_PATTERN = /otpauth:\/\/totp\/(.+)(%3A|:)(.+)\?.+/
export const parseOAuthOTP = (url) => {
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
    if (issuer !== 'ONE Wallet' && issuer !== 'Harmony') {
      message.error('Invalid issuer of the recovery QR code. Must be either `ONE Wallet` or `Harmony`')
      return null
    }
    return { name: decodeURIComponent(m[3]), secret }
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
    message.error('You selected more than one authenticator entry to export. Please reselect on Google Authenticator')
    return null
  }
  let secret2
  if (filteredParams.length === 2) {
    const names = filteredParams.map(e => e.name.split('-')[0].trim()).map(e => e.split('(')[0].trim())
    if (names[0] !== names[1]) {
      message.error('You selected two wallets with different names. If you want to select two entries belonging to the same wallet, make sure they have the same name and the second one has "- 2nd" in the end')
      return undefined
    }
    secret2 = filteredParams[1]?.secret
  }
  const secret = filteredParams[0]?.secret
  const name = filteredParams[0]?.name
  return { secret, secret2, name }
}
