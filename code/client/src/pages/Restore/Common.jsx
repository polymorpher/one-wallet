import util from '../../util'
import message from '../../message'
import { api } from '../../../../lib/api'
import * as Sentry from '@sentry/browser'

export const retrieveWalletInfoFromAddress = async (address) => {
  const oneAddress = util.safeOneAddress(address)
  message.info(`Retrieving wallet information from ${oneAddress}`)
  try {
    const {
      root,
      effectiveTime,
      duration,
      slotSize,
      lastResortAddress,
      majorVersion,
      minorVersion,
      spendingLimit,
      spendingInterval,
      lastLimitAdjustmentTime,
      highestSpendingLimit,
    } = await api.blockchain.getWallet({ address })
    message.info('Wallet information retrieved from blockchain')

    const wallet = {
      address,
      root,
      effectiveTime,
      duration,
      slotSize,
      lastResortAddress,
      majorVersion,
      minorVersion,
      spendingLimit,
      spendingInterval,
      lastLimitAdjustmentTime,
      highestSpendingLimit,
    }
    console.log('Retrieved wallet:', wallet)
    return { wallet }
  } catch (ex) {
    Sentry.captureException(ex)
    console.error(ex)
    const errorMessage = ex.toString()
    if (errorMessage.includes('no code at address')) {
      message.error('This is a wallet, but is not a 1wallet address')
    } else if (errorMessage.includes('Returned values aren\'t valid')) {
      message.error('This is a smart contract, but is not a 1wallet')
    } else {
      message.error(`Cannot retrieve 1wallet at address ${address}. Error: ${ex.toString()}`)
    }
  }
}
