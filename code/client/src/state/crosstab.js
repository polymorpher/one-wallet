import { REHYDRATE } from 'redux-persist/lib/constants'
import { BroadcastChannel } from 'broadcast-channel';

/**
 * Event listener to update cross browser tab redux store
 * Inspired from https://github.com/rt2zz/redux-persist-crosstab
 * and https://github.com/rt2zz/redux-persist-crosstab/issues/7#issuecomment-355528453
 */
export function crosstab (store, persistConfig, crosstabConfig = {}) {
  const {blocklist = null, accesslist = null, allowActions = null} = crosstabConfig
  const { key } = persistConfig

  let channel
  let dispatchingSelf = false

  // https://github.com/pubkey/broadcast-channel#handling-indexeddb-onclose-events
  const createChannel = () => {
    channel = new BroadcastChannel('1wallet-crosstab', {
      idb: {
        onclose: () => {
          channel.close()
          createChannel()
        }
      }
    })

    channel.onmessage = (msg) => {
      if (msg?._persist?.rehydrated) {
        const state = Object.keys(msg).reduce((state, reducerKey) => {
          if (accesslist && accesslist.indexOf(reducerKey) === -1) {
            return state
          }
          if (blocklist && blocklist.indexOf(reducerKey) !== -1) {
            return state
          }
          state[reducerKey] = msg[reducerKey]
          return state 
        }, {})

          dispatchingSelf = true
          store.dispatch({
            key: key,
            payload: state,
            type: REHYDRATE,
          })
      }
    }
  }
  createChannel()

  // Subscribe to Redux store State Changes
  store.subscribe(() => {
    if (dispatchingSelf) {
      dispatchingSelf = false
      return false
    }
    const allowed = allowActions?.indexOf(store.getState().lastAction) !== -1
    if (channel && allowed) {
      channel.postMessage(store.getState())
    }
  })
}
