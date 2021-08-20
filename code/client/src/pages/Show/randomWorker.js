import { useEffect, useRef, useState } from 'react'

export const useRandomWorker = () => {
  const [worker, setWorker] = useState()
  const workerRef = useRef({ promise: null }).current
  const resetWorker = () => {
    workerRef.promise = new Promise((resolve, reject) => {
      worker.onmessage = (event) => {
        const { status, error, result } = event.data
        // console.log('Received: ', { status, result, error })
        if (status === 'rand') {
          const { rand } = result
          resolve(rand)
        } else if (status === 'error') {
          reject(error)
        }
      }
    })
  }
  useEffect(() => {
    const worker = new Worker('/ONEWalletWorker.js')
    setWorker(worker)
  }, [])
  useEffect(() => {
    worker && resetWorker(worker)
  }, [worker])

  const recoverRandomness = async (args) => {
    worker && worker.postMessage({
      action: 'recoverRandomness',
      ...args
    })
    return workerRef.promise
  }
  return {
    resetWorker,
    recoverRandomness,
    worker,
    setWorker
  }
}
