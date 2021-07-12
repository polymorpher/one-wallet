import config from './config'
import { cloneDeep, merge } from 'lodash'
const state = {
  wallet: {
    relayer: config.defaults.relayer,
    network: config.defaults.network,
    relayerSecret: config.defaults.relayerSecret
  }
}

export const getState = () => cloneDeep(state)
export const mergeState = (newState) => merge(state, newState)
