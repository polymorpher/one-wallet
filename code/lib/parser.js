const EventMessage = require('./event-message')
const EventMap = require('./events-map.json')
const EventParams = require('./events-params.json')
const ONEUtil = require('./util')
const ONEConstant = require('./constants')
// `logs` are obtained from a transaction receipt, from the result of eth_getTransactionReceipt JSON RPC
function parseTxLog (logs) {
  const events = []
  for (const log of logs || []) {
    const decodedEvents = {}
    for (const topic of log.topics) {
      const eventName = EventMap[topic]
      if (!eventName) {
        continue
      }
      const eventDetail = EventMessage[eventName]
      decodedEvents[eventName] = ONEUtil.abi.decodeParameters(EventParams[eventName].params, log.data)
      const amount = EventParams[eventName].amountIndex >= 0 && decodedEvents[eventName][EventParams[eventName].amountIndex]
      const data = { ...decodedEvents[eventName], amount }
      let message = eventDetail?.message
      if (eventDetail?.messageTemplate) {
        message = formatMessageTemplate(eventDetail.messageTemplate, data)
      }
      const event = { eventName, message, type: eventDetail?.type, data }
      events.push(event)
    }
  }
  return events
}

const REPLACERS = {
  '{{amount}}': d => d.amount,
  '{{op:1}}': d => ONEConstant.OperationType[d[0]],
  '{{op:2}}': d => ONEConstant.OperationType[d[1]],
  '{{op:3}}': d => ONEConstant.OperationType[d[2]],
  '{{sa:0}}': d => ONEConstant.StakingAction[d[0]],
  '{{sa:1}}': d => ONEConstant.StakingAction[d[1]],
  '{{sa:2}}': d => ONEConstant.StakingAction[d[2]],
  '{{1}}': d => d[1],
  '{{2}}': d => d[2],
  '{{3}}': d => d[3],
  '{{4}}': d => d[4],
  '{{5}}': d => d[5],
  '{{6}}': d => d[6]
}

function formatMessageTemplate (messageTemplate = '', data = {}) {
  let message = messageTemplate
  for (const [k, v] of Object.entries(REPLACERS)) {
    message = message.replace(k, v(data))
  }
  return message
}

module.exports = { parseTxLog, formatMessageTemplate }
