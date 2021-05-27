import Web3 from 'web3'

import walletArtifacts from '../../build/contracts/TOTPWallet.json'
import dailyLimitArtifact from '../../build/contracts/DailyLimit.json'

import contract from '@truffle/contract'
const TOTPWallet = contract(walletArtifacts)
const DailyLimit = contract(dailyLimitArtifact)

// import guardiansArtifact from '../../build/contracts/Guardians.json'
// import recoveryArtifact from '../../build/contracts/Recovery.json'

// const Guardians = contract(guardiansArtifact)
// const Recovery = contract(recoveryArtifact)

console.log(DailyLimit)

TOTPWallet.setProvider(window.web3.currentProvider)

const networks = {
  0x4: 'rinkeby',
  1337: 'dev', // ganache
  0x6357d2e0: 'harmony-testnet',
  0x6357d2e1: 'harmony-testnet',
  0x6357d2e2: 'harmony-testnet',
  0x6357d2e3: 'harmony-testnet',
  0x63564c40: 'harmony-mainnet',
  0x63564c41: 'harmony-mainnet',
  0x63564c42: 'harmony-mainnet',
  0x63564c43: 'harmony-mainnet'
}
const CONFIGS = {
  0x4: {
    DailyLimit: '0xe99810556BbE9e2EAA48F84eE6450Aa5a18Fb2B4',
    Guardians: '0xf3ad04b291B3E3f441cFde0C7d41353361282bbb',
    Recovery: '0x1bE4e84647843b10bA8D3726F3baCcEC4950Bda5',
    limit: Web3.utils.toWei('0.01', 'ether'),
  },
  1337: {
    DailyLimit: '0xe56931116EA32B3898fAc95174B68F8Ce9311824',
    Guardians: '0xB066f5a3889373E166b1FDc6B190f9971a1Ae3b7',
    Recovery: '0xDC6bf8965777729bdAcDc9699440D38399f4f3f2',
    limit: Web3.utils.toWei('0.01', 'ether'),
  },
  0x6357d2e0: {
    DailyLimit: '0x71B48CC260360950428fB842f5DD38cE873a11df',
    Guardians: '0xc44Ea215a81caC2e7E8aE23911D082EcB2a2D23C',
    Recovery: '0xE168817e6d7066E2f2E4a85E26eaB47E0d82acF6',
    limit: Web3.utils.toWei('100', 'ether'),
  },
  0x63564c40: {
    DailyLimit: '0xF05A07F42A79BcBBB5ab43726FA64c1e0f16C20c',
    Guardians: '0xd695cFb61410e5428Ff49ccFD87d3419D45c47fA',
    Recovery: '0x0AD5a8c503B8e8a47D097f171Eb5BeD8D66d2ba1',
    limit: Web3.utils.toWei('100', 'ether'),
  }
}
window.App = {}

export async function refresh () {
  if (!window.ethereum) {
    await window.ethereum.enable()
  }
  let _accounts = await web3.eth.getAccounts()
  const chainId = parseInt(await window.ethereum.request({ method: 'eth_chainId' }))
  console.log(chainId)
  window.App.chainId = chainId
  window.App.network = networks[chainId]

  if (!(chainId in networks)) {
    alert(`Not supported chain id : ${chainId}`)
  }

  console.log('Using network ', window.App.network)

  window.App.accounts = _accounts
  window.App.defaultAccount = _accounts[0]
  TOTPWallet.defaults({ from: window.App.defaultAccount, gas: 5000 * 1000, gasPrice: 20 * 1000000000 })
  console.log(window.App)
}
export async function createWallet (rootHash, height, timePeriod, timeOffset, leafs, drainAddr) {
  await TOTPWallet.detectNetwork()
  TOTPWallet.link('DailyLimit', CONFIGS[window.App.chainId].DailyLimit)
  TOTPWallet.link('Guardians', CONFIGS[window.App.chainId].Guardians)
  TOTPWallet.link('Recovery', CONFIGS[window.App.chainId].Recovery)

  return TOTPWallet.new(rootHash, height, timePeriod, timeOffset, drainAddr, CONFIGS[window.App.chainId].limit).then((e) => {
    console.log(e)
    localStorage.setItem(`wallet:${e.address}`, JSON.stringify({
      tx: e.transactionHash,
      leafs
    }))
    return e
  })
}

export async function loadWallet (address) {
  const wallet = await TOTPWallet.at(address)
  const walletData = await wallet.wallet()
  console.log(wallet)
  return {
    rootHash: walletData.rootHash,
    height: walletData.merkelHeight,
    timePeriod: walletData.timePeriod,
    timeOffset: walletData.timeOffset,
    dailyLimit: walletData.dailyLimit,
    spentToday: walletData.spentToday,
    drainAddr: walletData.drainAddr,
    balance: await web3.eth.getBalance(address),
    guardians: await wallet.getGuardians(),
    isRecovering: await wallet.isRecovering(),
    contract: wallet
  }
}

export function getWallets () {
  const wallets = []
  for (const key in localStorage) {
    console.log(key)
    if (key.startsWith('wallet:')) {
      wallets.push(key.split(':')[1])
    }
  }
  return wallets
}

export async function load () {
  if (typeof web3 !== 'undefined') { // Checking if Web3 has been injected by the browser (Mist/MetaMask)
    // if (window.ethereum.isMetaMask) { // Checking if Web3 has been injected by the browser (Mist/MetaMask)
    console.warn('Using web3 detected from external source.')
    window.web3 = new Web3(web3.currentProvider) // Use Mist/MetaMask's provider
    await refresh()
    return window.App
  }
}
// window.addEventListener('load', async () => {
//     if (typeof web3 !== 'undefined') { // Checking if Web3 has been injected by the browser (Mist/MetaMask)
//         // if (window.ethereum.isMetaMask) { // Checking if Web3 has been injected by the browser (Mist/MetaMask)
//           console.warn('Using web3 detected from external source.')
//           window.web3 = new Web3(web3.currentProvider) // Use Mist/MetaMask's provider
//         await refresh();
//     }
// });
