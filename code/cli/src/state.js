import config from './config'
import cloneDeep from 'lodash/fp/cloneDeep'
import mergeAll from 'lodash/fp/merge'
const state = {
  wallet: {
    relayer: config.defaults.relayer,
    network: config.defaults.network,
    relayerSecret: config.defaults.relayerSecret
  }
}

export const getState = () => cloneDeep(state)
export const mergeState = (newState) => mergeAll(state, newState)
