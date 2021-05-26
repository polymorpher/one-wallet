const TOTPWallet = artifacts.require('TOTPWallet')
const Guardians = artifacts.require('Guardians')
const DailyLimit = artifacts.require('DailyLimit')
const Recovery = artifacts.require('Recovery')
const totp = require('../lib/totp.js')
const merkle = require('../lib/merkle.js')
const ethers = require('ethers')
const ethAbi = require('web3-eth-abi')

function h16 (a) { return web3.utils.soliditySha3({ v: a, t: 'bytes', encoding: 'hex' }).substring(0, 34) }
function h16a (a) { return web3.utils.soliditySha3(a).substring(0, 34) }
function padNumber (x) { return web3.utils.padRight(x, 32) }
function getTOTP (counter, duration) { return totp('JBSWY3DPEHPK3PXP', { period: duration, counter: counter }) }

function getLeavesAndRoot (timeOffset, duration, depth) {
  const leaves = []
  // 1year / 300 ~= 105120
  // 2^17 = 131072
  // 1609459200 is 2021-01-01 00:00:00 --
  // to save space, we're going to start from counter above!
  const startCounter = timeOffset / duration
  // console.log("Start counter=", startCounter);

  for (let i = 0; i < Math.pow(2, depth); i++) {
    // console.log(i, web3.utils.padRight(getTOTP(startCounter+i),6));
    leaves.push(h16(padNumber(web3.utils.toHex(getTOTP(startCounter + i, duration)))))
  }
  const root = merkle.reduceMT(leaves)
  return { startCounter, leaves, root }
}
async function createWallet (timeOffset, duration, depth, drainAddr) {
  const { startCounter, leaves, root } = getLeavesAndRoot(timeOffset, duration, depth)

  const guardians = await Guardians.new()
  const dailyLimit = await DailyLimit.new()
  const recovery = await Recovery.new()
  await TOTPWallet.link('Guardians', guardians.address)
  await TOTPWallet.link('DailyLimit', dailyLimit.address)
  await TOTPWallet.link('Recovery', recovery.address)

  const wallet = await TOTPWallet.new(root, depth, duration, timeOffset, drainAddr, web3.utils.toWei('0.01', 'ether'))

  return {
    startCounter,
    root,
    leaves,
    wallet
  }
}

async function getTOTPAndProof (leaves, timeOffset, duration) {
  const { timestamp } = await web3.eth.getBlock('latest')
  console.log('time=', timestamp)

  const startCounter = timeOffset / duration
  const currentCounter = Math.floor((timestamp - timeOffset) / duration)
  const currentOTP = getTOTP(startCounter + currentCounter, duration)
  const proof = merkle.getProof(leaves, currentCounter, padNumber(web3.utils.toHex(currentOTP)))
  return proof
}

async function signRecoveryOffchain (signers, rootHash, merkelHeight, timePeriod, timeOffset) {
  const messageHash = getMessageHash(rootHash, merkelHeight, timePeriod, timeOffset)
  const signatures = await Promise.all(
    signers.map(async (signer) => {
      const sig = await signMessage(messageHash, signer)
      return sig.slice(2)
    })
  )
  const joinedSignatures = `0x${signatures.join('')}`
  // console.log("sigs", joinedSignatures);

  return joinedSignatures
}

function getMessageHash (rootHash, merkelHeight, timePeriod, timeOffset) {
  const TYPE_STR = 'startRecovery(bytes16, uint8, uint, uint)'
  const TYPE_HASH = ethers.utils.keccak256(Buffer.from(TYPE_STR))

  // console.log(rootHash, merkelHeight, timePeriod, timeOffset, TYPE_HASH);

  const encodedRequest = ethAbi.encodeParameters(
    ['bytes32', 'bytes16', 'uint8', 'uint', 'uint'],
    [TYPE_HASH, rootHash, merkelHeight, timePeriod, timeOffset]
  )

  const messageHash = ethers.utils.keccak256(encodedRequest)
  return messageHash
}

async function signMessage (message, signer) {
  const sig = await signer.sign(message).signature
  // console.log(message, sig);
  let v = parseInt(sig.substring(130, 132), 16)
  if (v < 27) v += 27
  const normalizedSig = `${sig.substring(0, 130)}${v.toString(16)}`
  return normalizedSig
}
//
// function sortWalletByAddress (wallets) {
//   return wallets.sort((s1, s2) => {
//     const bn1 = ethers.BigNumber.from(s1)
//     const bn2 = ethers.BigNumber.from(s2)
//     if (bn1.lt(bn2)) return -1
//     if (bn1.gt(bn2)) return 1
//     return 0
//   })
// }

async function web3GetClient () {
  return new Promise((resolve, reject) => {
    web3.eth.getNodeInfo((err, res) => {
      if (err !== null) return reject(err)
      return resolve(res)
    })
  })
}

async function increaseTime (seconds) {
  const client = await web3GetClient()
  const p = new Promise((resolve, reject) => {
    if (client.indexOf('TestRPC') === -1) {
      console.warning('Client is not ganache-cli and cannot forward time')
    } else {
      web3.currentProvider.send(
        {
          jsonrpc: '2.0',
          method: 'evm_increaseTime',
          params: [seconds],
          id: 0,
        },
        (err) => {
          if (err) {
            return reject(err)
          }
          return web3.currentProvider.send(
            {
              jsonrpc: '2.0',
              method: 'evm_mine',
              params: [],
              id: 0,
            },
            (err2, res) => {
              if (err2) {
                return reject(err2)
              }
              return resolve(res)
            }
          )
        }
      )
    }
  })
  return p
}

module.exports = {
  h16,
  h16a,
  padNumber,
  getTOTP,
  createWallet,
  getTOTPAndProof,
  getLeavesAndRoot,
  signRecoveryOffchain,
  increaseTime
}
