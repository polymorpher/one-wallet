import ONEUtil from '../../../lib/util'
import { api } from '../../../lib/api'
export const knownContracts = {
  '0x4f9b1dEf3a0f6747bF8C870a27D3DeCdf029100e': {
    name: 'Gnosis Safe Proxy Factory',
    verifiedDomains: [/https:\/\/multisig\.harmony\.one.+/],
    methods: {
      '0x1688f0b9': {
        name: 'createProxyWithNonce',
        params: ['address', 'bytes', 'uint256']
      }
    }
  }
}

export const knownCodeHashes = {
  '0x26fd76db23f874f91bf08a2c32a5d046d0a41b9fe39b8585cfa4fc23c2283a7f': {
    name: 'Gnosis Safe Instance',
    verifiedDomains: [/https:\/\/multisig\.harmony\.one.+/],
    methods: {
      '0x6a761202': {
        name: 'execTransaction',
        params: ['address', 'uint256', 'bytes', 'uint8', 'uint256', 'uint256', 'uint256', 'address', 'address', 'bytes']
      },
      '0xd4d9bdcd': {
        name: 'approveHash',
        params: ['bytes32']
      }
    }
  }
}

export const decodeContractCall = async ({ callee, bytes }) => {
  const c = callee
  const method = bytes.slice(0, 10)
  const m = c.methods[method]
  if (!m) {
    const candidates = await api.explorer.decodeMethod(bytes)
    for (const candidate of candidates) {
      let r
      try {
        if (!candidate.signature) {
          continue
        }
        r = ONEUtil.decodeMethodParameters(candidate.signature, bytes)
      } catch (ex) {
        console.error(ex)
        continue
      }
      if (r) {
        return { name: c.name, method: m.name, parameters: r, verifiedDomains: c.verifiedDomains }
      }
    }
    return { name: c.name, verifiedDomains: c.verifiedDomains }
  }
  try {
    const decoded = ONEUtil.abi.decodeParameters(m.params, bytes.slice(10))
    const r = []
    for (let i = 0; i < m.params.length; i++) {
      r.push({ name: m.params[i], value: decoded[i] })
    }
    return { name: c.name, method: m.name, parameters: r, verifiedDomains: c.verifiedDomains }
  } catch (ex) {
    console.error(ex)
    return { error: ex.toString() }
  }
}

export const decodeKnownCall = async ({ address, bytes }) => {
  const c = knownContracts[address]
  // console.log(address, c)
  if (c) {
    return decodeContractCall({ callee: c, bytes })
  }
  const code = await api.blockchain.getCode({ address })
  if (code === '0x' || !code) {
    return { error: 'Address has no code' }
  }
  const h = knownCodeHashes[ONEUtil.hexString(ONEUtil.keccak(code))]
  if (h) {
    return decodeContractCall({ callee: h, bytes })
  }
  return { }
}
