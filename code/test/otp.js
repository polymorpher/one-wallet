const ONEUtil = require('../lib/util')
const INTERVAL = 30000
const DURATION = INTERVAL * 8
const base32 = require('hi-base32')

contract('ONEWallet', (accounts) => {
  // 2021-06-13T03:55:00.000Z
  const EFFECTIVE_TIME = Math.floor(1623556500000 / INTERVAL) * INTERVAL - DURATION / 2
  it('must generate the right otp', async () => {
    // set up at google authenticator, using base32 encoded key: GB4GIZLBMRRGKZLGGEZDGNBVGY3TQOJQ
    const seed = base32.decode.asBytes(base32.encode('0xdeadbeef1234567890')).slice(0, 20) // emulating the testing process
    const effectiveTime = Math.floor(EFFECTIVE_TIME / INTERVAL) * INTERVAL
    const counter = Math.floor(effectiveTime / INTERVAL)
    const n = 16
    const otps = ONEUtil.genOTP({ seed, counter, n })
    const singleOTP = ONEUtil.genOTP({ seed, counter: Math.floor(1623556500000 / INTERVAL) })
    const currentOTP = ONEUtil.genOTP({ seed })
    const otpInts = []
    for (let i = 0; i < n; i += 1) {
      const otp = new DataView(otps.buffer).getUint32(i * 4, false)
      otpInts.push([effectiveTime + INTERVAL * i, otp])
    }
    const singleOTPInt = new DataView(singleOTP.buffer).getUint32(0, false)
    assert(singleOTPInt === 421439)
    assert(otpInts.map(e => e[1]).includes(singleOTPInt))
    assert(otpInts.find(e => e[1] === singleOTPInt)[0] === 1623556500000)
    const currentOTPInt = new DataView(currentOTP.buffer).getUint32(0, false)
    console.log('compare this against current value in google authenticator',
      currentOTPInt,
      `(time=${Math.floor(Date.now() / INTERVAL) * INTERVAL})`) // compare this against google authenticator
  })
})
