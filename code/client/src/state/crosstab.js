import { REHYDRATE } from 'redux-persist/lib/constants'

/**
 * Event listener to update cross browser tab redux store
 * Inspired from https://github.com/rt2zz/redux-persist-crosstab
 * and https://github.com/rt2zz/redux-persist-crosstab/issues/7#issuecomment-355528453
 */
export function crosstab (store, persistConfig, crosstabConfig = {}) {
  const blocklist = crosstabConfig.blocklist || null
  const accesslist = crosstabConfig.accesslist || null

  const { key } = persistConfig

  if (window.BroadcastChannel) {
    const channel = new window.BroadcastChannel('crosstabState-channel')
    let dispatchingSelf = false

    // Subscribe to Redux store State Changes
    store.subscribe(() => {
      if (dispatchingSelf) {
        dispatchingSelf = false
        return false
      }

      channel.postMessage(store.getState())
    })

    // Listen to Redux store State Changes message and rehydrate
    channel.addEventListener('message', ev => {
      dispatchingSelf = true

      const state = Object.keys(ev.data).reduce((state, reducerKey) => {
        if (accesslist && accesslist.indexOf(reducerKey) === -1) {
          return state
        }
        if (blocklist && blocklist.indexOf(reducerKey) !== -1) {
          return state
        }

        state[reducerKey] = ev.data[reducerKey]

        return state
      }, {})

      store.dispatch({
        key: key,
        payload: state,
        type: REHYDRATE,
      })
    })
  }
}
