let message
const setMessage = (newMessage) => {
  message = newMessage
}
const getMessage = () => message

module.exports = {
  setMessage,
  getMessage
}
