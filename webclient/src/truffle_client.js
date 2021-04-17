import { default as Web3 } from 'web3'

import walletArtifacts from '../../build/contracts/TOTPWallet.json'
var contract = require("@truffle/contract");
var TOTPWallet = contract(walletArtifacts)
TOTPWallet.setProvider(window.web3.currentProvider)
var App = {}

export async function refresh() {
    var _accounts = (undefined != window.ethereum)? await window.ethereum.enable(): await web3.eth.getAccounts();
    App.accounts = _accounts;
    App.defaultAccount = _accounts[0];
    TOTPWallet.defaults({ from: App.defaultAccount, gas: 7.3 * 1000 * 1000, gasPrice: 20 * 1000000000 })
    console.log(App);
}
export function createWallet(rootHash, height, timePeriod, timeOffset, leafs) {
    return TOTPWallet.new(rootHash, height, timePeriod, timeOffset).then(e=>{
        console.log(e);
        localStorage.setItem("wallet:"+e.address, JSON.stringify({
            tx: e.transactionHash,
            leafs: leafs
        }))
        return e
    })
}

export async function loadWallet(address) {
    var wallet = await TOTPWallet.at(address);
    return {
        rootHash: await wallet.rootHash(),
        height: await wallet.treeHeight(),
        timePeriod: await wallet.timePeriod(),
        timeOffset: await wallet.timeOffset(),
        balance: await web3.eth.getBalance(address),
        contract: wallet
    }
}

export function getWallets() {
    var wallets = [];
    for (var key in localStorage){
        console.log(key)
        if (key.startsWith("wallet:")) {
            wallets.push(key.split(":")[1]);
        }
    }
    return wallets;
}

window.addEventListener('load', async () => {
    if (typeof web3 !== 'undefined') { // Checking if Web3 has been injected by the browser (Mist/MetaMask)
        // if (window.ethereum.isMetaMask) { // Checking if Web3 has been injected by the browser (Mist/MetaMask)
          console.warn('Using web3 detected from external source.')
          window.web3 = new Web3(web3.currentProvider) // Use Mist/MetaMask's provider      
        App.network = "rinkeby";
        console.log("Using network ", App.network)
        await refresh();
    }
});