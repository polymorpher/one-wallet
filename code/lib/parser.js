const EventMessage = require('./event-message')
const EventMap = require('./events-map.json')
const EventParams = require('./events-params.json')
const ONEUtil = require('./util')
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
      const event = { eventName, message: eventDetail?.message, type: eventDetail?.type }

      if (EventParams[eventName].amountIndex >= 0) {
        event.amount = decodedEvents[eventName][EventParams[eventName].amountIndex]
      }
      events.push(event)
    }
  }
  return events
}

module.exports = { parseTxLog }
