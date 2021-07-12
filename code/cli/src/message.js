const Messenger = {
  error: console.error,
  log: console.log
}

export const updateMessenger = ({ error, log }) => {
  Messenger.error = error
  Messenger.log = log
}

export const message = {
  error: (m) => console.error('[ERROR  ]', m),
  warning: (m) => console.log('[WARNING]', m),
  info: (m) => console.log('[INFO   ]', m),
  success: (m) => console.log('[SUCCESS]', m),
}
