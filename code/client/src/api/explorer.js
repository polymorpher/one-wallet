const EXPLORER_URL = process.env.EXPLORER_URL ?? 'wss://ws.explorer-v2-api.hmny.io/socket.io/?EIO=4&transport=websocket'

let _ws = null
export const initWs = async () => {
  if (_ws && _ws.readyState === _ws.OPEN) {
    return _ws
  }
  const ws = new WebSocket(EXPLORER_URL)
  let greeted = false
  await new Promise((resolve, reject) => {
    ws.addEventListener('error', er => {
      console.error(er)
      reject(er)
    })
    ws.addEventListener('open', function open () {
      ws.send('40')
      // ws.send('420["getContractsByField",[0,"address","0x041d5200177b91174477ce0badef402d8e8229c3"]]');
    })
    const listener = (event) => {
      const data = event.data
      if (data.toString().startsWith('40') && !greeted) {
        greeted = true
        console.log('WS connected')
        ws.removeEventListener('message', listener)
        resolve()
      }
    }
    ws.addEventListener('message', listener)
  })
  _ws = ws
  return ws
}

export const getErc721Assets = async (address) => {
  const ws = await initWs()
  let done = false
  return await new Promise((resolve) => {
    const listener = (event) => {
      if (done) {
        return
      }
      const data = event.data
      const s = data.toString()
      // console.log(s)
      if (s.startsWith('431')) {
        const ss = s.slice(3)
        const payload = JSON.parse(ss)?.[0].payload || '{}'
        const assets = JSON.parse(payload) || []
        done = true
        ws.removeEventListener('message', listener)
        resolve(assets)
      }
    }
    ws.addEventListener('message', listener)
    ws.send(`421["getUserERC721Assets",[0,"${address.toLowerCase()}"]]`)
  })
}

export const getErc1155Balances = async (address) => {
  const ws = await initWs()
  let done = false
  return await new Promise((resolve) => {
    const listener = (event) => {
      if (done) {
        return
      }
      const data = event.data
      const s = data.toString()
      // console.log(s)
      if (s.startsWith('435')) {
        const ss = s.slice(3)
        const payload = JSON.parse(ss)?.[0].payload || '{}'
        const assets = JSON.parse(payload) || []
        done = true
        ws.removeEventListener('message', listener)
        resolve(assets)
      }
    }
    ws.addEventListener('message', listener)
    ws.send(`425["getUserERC1155Balances",[0,"${address.toLowerCase()}"]]`)
  })
}
