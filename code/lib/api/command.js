const ONEUtil = require('../util')
const ONEConstants = require('../constants')
const ONE = require('../onewallet')
const BN = require('bn.js')
const { api } = require('./index')

const Op = ONEConstants.OperationType

const makeParams = (params) => ({ commitHashGenerator: ONE.computeGeneralOperationHash, revealAPI: api.relayer.reveal, commitRevealArgs: params })
const Command = ({ backlinkAddress, wallet }) => ({
  transform ({ operationType, ...args }) {
    if (operationType === Op.TRANSFER_DOMAIN) {
      return this.domainTransfer(args)
    } else if (operationType === Op.TRANSFER) {
      return this.transfer(args)
    } else if (operationType === Op.CALL) {
      return this.call(args)
    } else if (operationType === Op.RECOVER) {
      return this.recover(args)
    } else if (operationType === Op.CHANGE_SPENDING_LIMIT) {
      return this.changeLimit(args)
    } else if (operationType === Op.JUMP_SPENDING_LIMIT) {
      return this.changeLimit({ ...args, jump: true })
    } else if (operationType === Op.BUY_DOMAIN) {
      return this.buyDomain(args)
    } else if (operationType === Op.RECOVER_SELECTED_TOKENS) {
      return this.recoverSelectedTokens(args)
    } else if (operationType === Op.BATCH) {
      return this.batch(args)
    } else if (operationType === Op.SET_RECOVERY_ADDRESS) {
      return this.setRecoveryAddress(args)
    } else if (operationType === Op.DELEGATE) {
      return this.setRecoveryAddress(args)
    } else if (operationType === Op.UNDELEGATE) {
      return this.setRecoveryAddress(args)
    } else if (operationType === Op.COLLECT_REWARD) {
      return this.setRecoveryAddress(args)
    } else {
      return this.general(args)
    }
  },

  general: ({ operationType, tokenType, contractAddress, tokenId, dest, amount, data: opData = new Uint8Array() }) => {
    const data = ONEUtil.makeCommandData(backlinkAddress, operationType, opData)
    const params = {
      operationType: Op.COMMAND,
      tokenType,
      contractAddress,
      tokenId,
      dest,
      amount,
      data,
    }
    return makeParams(params)
  },

  transfer: ({ dest, amount }) => {
    const data = ONEUtil.makeCommandData(backlinkAddress, Op.TRANSFER)
    const params = {
      ...ONEConstants.NullOperationParams,
      operationType: Op.COMMAND,
      dest,
      amount,
      data
    }
    return makeParams(params)
  },

  // needed when source wallet has a balance over spend limit, when forward operation occurred. The remaining tokens can be transferred out using this function, in the next interval
  domainTransfer: ({
    parentLabel = ONEConstants.Domain.DEFAULT_PARENT_LABEL,
    tld = ONEConstants.Domain.DEFAULT_TLD,
    registrar = ONEConstants.Domain.DEFAULT_SUBDOMAIN_REGISTRAR,
    resolver = ONEConstants.Domain.DEFAULT_RESOLVER,
    subdomain,
    dest,
  }) => {
    const data = ONEUtil.makeCommandData(backlinkAddress, Op.TRANSFER_DOMAIN)
    const subnode = ONEUtil.namehash([subdomain, parentLabel, tld].join('.'))
    const tokenId = new BN(ONEUtil.hexStringToBytes(resolver, 32), 10).toString()
    const amount = new BN(subnode, 10).toString()
    const params = {
      operationType: Op.COMMAND,
      tokenType: ONEConstants.TokenType.NONE,
      contractAddress: registrar,
      tokenId,
      dest,
      amount,
      data,
    }
    return makeParams(params)
  },
  call: ({ dest, amount, data: opData }) => {
    const data = ONEUtil.makeCommandData(backlinkAddress, Op.CALL, opData)
    const params = {
      ...ONEConstants.NullOperationParams,
      operationType: Op.COMMAND,
      dest,
      amount,
      data
    }
    return makeParams(params)
  },
  recover: () => {
    const data = ONEUtil.makeCommandData(backlinkAddress, Op.RECOVER)
    const params = {
      ...ONEConstants.NullOperationParams,
      operationType: Op.COMMAND,
      data
    }
    return makeParams(params)
  },

  changeLimit: ({ amount, jump = false }) => {
    const data = ONEUtil.makeCommandData(backlinkAddress, jump ? Op.JUMP_SPENDING_LIMIT : Op.CHANGE_SPENDING_LIMIT)
    const params = {
      ...ONEConstants.NullOperationParams,
      operationType: Op.COMMAND,
      amount,
      data
    }
    return makeParams(params)
  },

  buyDomain: ({ maxPrice, subdomain, data: opData }) => {
    const data = ONEUtil.makeCommandData(backlinkAddress, Op.RECOVER, opData)
    const params = {
      ...ONEConstants.NullOperationParams,
      operationType: Op.COMMAND,
      maxPrice,
      subdomain,
      data
    }
    return makeParams(params)
  },

  recoverSelectedTokens: ({ data: opData, dest }) => {
    const data = ONEUtil.makeCommandData(backlinkAddress, Op.RECOVER_SELECTED_TOKENS, opData)
    const params = {
      ...ONEConstants.NullOperationParams,
      operationType: Op.COMMAND,
      dest,
      data
    }
    return makeParams(params)
  },
  batch: ({ data: opData }) => {
    const data = ONEUtil.makeCommandData(backlinkAddress, Op.BATCH, opData)
    const params = {
      ...ONEConstants.NullOperationParams,
      operationType: Op.COMMAND,
      data
    }
    return makeParams(params)
  },
  setRecoveryAddress: ({ dest }) => {
    const data = ONEUtil.makeCommandData(backlinkAddress, Op.SET_RECOVERY_ADDRESS)
    const params = {
      ...ONEConstants.NullOperationParams,
      operationType: Op.COMMAND,
      dest,
      data
    }
    return makeParams(params)
  },
  delegate: ({ dest, amount }) => {
    const data = ONEUtil.makeCommandData(backlinkAddress, Op.DELEGATE)
    const params = { ...ONEConstants.NullOperationParams, operationType: Op.COMMAND, dest, amount, data }
    return makeParams(params)
  },
  undelegate: ({ dest, amount }) => {
    const data = ONEUtil.makeCommandData(backlinkAddress, Op.UNDELEGATE)
    const params = { ...ONEConstants.NullOperationParams, operationType: Op.COMMAND, dest, amount, data }
    return makeParams(params)
  },
  collectReward: () => {
    const data = ONEUtil.makeCommandData(backlinkAddress, Op.COLLECT_REWARD)
    const params = { ...ONEConstants.NullOperationParams, operationType: Op.COMMAND, data }
    return makeParams(params)
  },

})

module.exports = { Command }
