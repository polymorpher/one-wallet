// https://github.com/hussy-io/truffle-ledger-provider/issues/9 -- fixing the issue
import { default as Web3 } from 'web3'
import { default as bip39 } from 'bip39'
import { default as unorm } from 'unorm'

// import QrScanner from 'qr-scanner'; // direct import from npm package - but we do not want it, since we made some modification to lib
import QrScanner from '../js/qr-scanner/qr-scanner.js';

import ENGLISH_WORDLIST from './wordlists/english.json'
import walletFactoryArtifacts from '../../build/contracts/WalletHandleFactory.json'
import walletArtifacts from '../../build/contracts/WalletHandle.json' const AUTH_MODES = Object.freeze({"NOAUTH": 0,  "HWAUTH" : 1}); // ENUM of modes
const CUR_AUTH_MODE = AUTH_MODES.HWAUTH;

var MAX_DEPTH_OF_CACHE = 7; // due to limitation of mainnet in Ethereum
var NETWORKS = Object.freeze({ "ADVANCED" : "advanced", "TEST" : "test", "ROPSTEN" : "ropsten"});
const LOCAL_NET_ID = 1234; // ID of network from truffle config file

const APPLY_WALLET = Object.freeze({"FROM_ADDRESS": 1,  "FROM_LOCAL_STORAGE" : 2}); // ENUM of modes how to use an existing wallet
const REFRESH_TIMEOUT = 5000;
const MIN_SUBTREE_LEAVES = 2; // as the last one is for introduction of the next tree
const NULL_ADDRESS = "0x0000000000000000000000000000000000000000";
const ETH_TO_WEI = parseFloat("1000000000000000000");

require("@babel/polyfill");
var contract = require("@truffle/contract");
QrScanner.WORKER_PATH = '../js/qr-scanner/qr-scanner-worker.min.js'; // created by "./node_modules/.bin/rollup -c" in updated nimiq's github project
// in detail the result of the promise also returns binary data, not only textual

// Authenticator class
var AuthenticatorMT = require("../../lib/authenticator.js");
var TruffleContractWHFactory = contract(walletFactoryArtifacts)
var TruffleContractWH = contract(walletArtifacts)

// ENUM of operation types
var OPER = Object.freeze({ "TRANSFER": 0, "DAILY_LIMIT": 1, 'LAST_RES_ADDR' : 2, 'LAST_RES_TIMEOUT' : 3, 'DESTRUCT' : 4, 'NOP' : 5 })
const SUBTREES_DEFAULT_RATIO = 4 // means that each parent tree is by default dived into 4 subtrees
// const ROPSTEN_OWNER_OF_FACTORY = "0x41bE05ee8D89c0Bc9cA87faC4488ad6e6A06D97E"
const DEFAULT_LAST_RESORT_ADDR = '0xE5987aD5605b456C1247180C4034587a94Da6A1D'
const ROPSTEN_WALLET_FACTORY = '0x1Ba285c1fc728CFaaCacC1cD47dBfa8652cBeACF'; // address of pre-deployed wallet factory

// const TESTRPC_OWNER_OF_FACTORY = "0xF66813EF76e97a70Dab82f1c1D5132Ba85Abbe2e"
const DEFAULT_LAST_RES_TIMEOUT = '3' // days
const PRELOADED_WALLETS_CACHE = require('./existing-wallets.js');

/// ////////////////////////////////
/// / Adapter for authenticator ////
/// ////////////////////////////////

var mtAdapter = {

  auth: null, // reference to authenticator
  currentSubtreeIdx: null,

  init: function (numLeaves, numSubtreeLeaves, hashChainLen, idxOfParrentTree, seedMnem, leavesData) {
    var subtree_height = Math.log2(numSubtreeLeaves)
    var subtree_depthOfCachedLayer = null
    this.currentSubtreeIdx = 0

    if (numSubtreeLeaves < MIN_SUBTREE_LEAVES) {
      App.alertAndHalt(`Number of subtree leaves must be at least equal to ${MIN_SUBTREE_LEAVES}`)
    }
    if (numLeaves < numSubtreeLeaves || numLeaves % numSubtreeLeaves !== 0) {
      App.alertAndHalt(`Number of parent leaves (${numLeaves}) is not divisible by number of subtree leaves (${numSubtreeLeaves})`)
    }

    if (subtree_height - 3 > 0) { // H_S - 3 is the optimal height
      subtree_depthOfCachedLayer = (subtree_height - 3 <= MAX_DEPTH_OF_CACHE) ? subtree_height - 3 : MAX_DEPTH_OF_CACHE
    } else {
      subtree_depthOfCachedLayer = 0
    }

    if (AUTH_MODES.HWAUTH === CUR_AUTH_MODE) {
      this.auth = new AuthenticatorMT(numLeaves, numSubtreeLeaves, subtree_depthOfCachedLayer, hashChainLen, seedMnem, idxOfParrentTree, leavesData, false, true)
    } else {
      this.auth = new AuthenticatorMT(numLeaves, numSubtreeLeaves, subtree_depthOfCachedLayer, hashChainLen, seedMnem, idxOfParrentTree, leavesData, true, true)
    }
  },

  getConfirmMaterial: function (otpID, OtpElemID) {
    if (AUTH_MODES.HWAUTH === CUR_AUTH_MODE) {
      var otpHash = validateMnemonicAndGetItsValue(OtpElemID)
      return mtAdapter.auth.getConfirmMaterial(otpID, '0x' + otpHash)
    } else {
      return this.auth.getConfirmMaterial(otpID)
    }
  },

  getOffsetOfCurrentSubtree: function () {
    return mtAdapter.auth.MT_child_numberOfOTPs * this.currentSubtreeIdx
  },

  generateNextParentTree: function (seedHex) {
    this.auth.generateNextParentTree(seedHex)
    this.currentSubtreeIdx = 0
  },
}

// var qrScanner = {
//     video: null,
//     canvasElement: null,
//     canvas: null,
//     loadingMessage: null,
//     outputContainer: null,
//     outputMessage: null,
//     outputData: null,

//     init: function(){
//         this.video = document.createElement("video");
//         this.canvasElement = document.getElementById("canvas");
//         this.canvas = this.canvasElement.getContext("2d");
//         this.loadingMessage = document.getElementById("loadingMessage");
//         this.outputContainer = document.getElementById("output");
//         this.outputMessage = document.getElementById("outputMessage");
//         this.outputData = document.getElementById("outputData");
//         this.initForPhones();
//     },

//     initForPhones: function(){
//       // Use facingMode: environment to attemt to get the front camera on phones
//       navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }).then(function(stream) {
//         // console.log("this.video = ", qrScanner.video);
//         qrScanner.video.srcObject = stream;
//         qrScanner.video.setAttribute("playsinline", true); // required to tell iOS safari we don't want fullscreen
//         qrScanner.video.play();
//         requestAnimationFrame(qrScanner.tick);
//       });
//     },

//     drawLine: function(begin, end, color) {
//       this.canvas.beginPath();
//       this.canvas.moveTo(begin.x, begin.y);
//       this.canvas.lineTo(end.x, end.y);
//       this.canvas.lineWidth = 4;
//       this.canvas.strokeStyle = color;
//       this.canvas.stroke();
//     },

//     tick: function() {
//       qrScanner.loadingMessage.innerText = "⌛ Loading video..."
//       if (qrScanner.video.readyState === qrScanner.video.HAVE_ENOUGH_DATA) {
//         qrScanner.loadingMessage.hidden = true;
//         qrScanner.canvasElement.hidden = false;
//         qrScanner.outputContainer.hidden = false;

//         qrScanner.canvasElement.height = qrScanner.video.videoHeight;
//         qrScanner.canvasElement.width = qrScanner.video.videoWidth;
//         qrScanner.canvas.drawImage(qrScanner.video, 0, 0, qrScanner.canvasElement.width, qrScanner.canvasElement.height);
//         var imageData = qrScanner.canvas.getImageData(0, 0, qrScanner.canvasElement.width, qrScanner.canvasElement.height);
//         var code = jsQR(imageData.data, imageData.width, imageData.height, {
//           inversionAttempts: "dontInvert",
//         });
//         if (code) {
//           qrScanner.drawLine(code.location.topLeftCorner, code.location.topRightCorner, "#FF3B58");
//           qrScanner.drawLine(code.location.topRightCorner, code.location.bottomRightCorner, "#FF3B58");
//           qrScanner.drawLine(code.location.bottomRightCorner, code.location.bottomLeftCorner, "#FF3B58");
//           qrScanner.drawLine(code.location.bottomLeftCorner, code.location.topLeftCorner, "#FF3B58");
//           qrScanner.outputMessage.hidden = true;
//           qrScanner.outputData.parentElement.hidden = false;
//           qrScanner.outputData.innerText = code.data;
//         } else {
//           qrScanner.outputMessage.hidden = false;
//           qrScanner.outputData.parentElement.hidden = true;
//         }
//       }
//       requestAnimationFrame(qrScanner.tick);
//       console.log("tick")
//     },
// }

var qrAdapter = {
  video: null,
  qrScanner: null,
  camHasCamera: null,

  init: function () {
    this.video = document.getElementById('qr-video')
      this.camHasCamera = document.getElementById('cam-has-camera')
      QrScanner.hasCamera().then(hasCamera => this.camHasCamera.textContent = hasCamera)
      this.qrScanner = new QrScanner(qrAdapter.video, result => qrAdapter.setResult(result))
    },
  scan: function (event) {
    event.preventDefault()
      var idxBuffer = event.data.param1
      $('#qr-code-stuff').css('display', 'block');
    $('#current-buffer-id').text(idxBuffer)
      $('#buffer-item-template-' + idxBuffer).find('.enter-otp-area').hide()
      $('#buffer-item-template-' + idxBuffer).find('.qr-code-just-scanning').show()
      var otpID = idxBuffer + mtAdapter.getOffsetOfCurrentSubtree() + 1
      $('#qr-code-stuff').find('.requested-otp-id').text(otpID)
      App.qrAdapter.qrScanner.start()
    },

  setResult: function (result) {
    console.log('scanned content = ', result)
      console.log('type of scanned content = ', typeof result)
      var idxBuffer = $('#current-buffer-id').text()
      var itemInBuf = $('#buffer-item-template-' + idxBuffer)
      itemInBuf.find('.confirm-oper-otp').show()

      var mnemonicStr
      if(result[0].length !== 0) {
      mnemonicStr = result[0]
      }else {
      console.log('Hex value of = ', bytesToHex(result[1]).substr(2, 32))
        mnemonicStr = bip39.entropyToMnemonic(bytesToHex(result[1]).substr(2, 32), ENGLISH_WORDLIST) // handle binary QR codes here
      }
    $('#cam-qr-result').text(mnemonicStr)
      itemInBuf.find('.confirm-oper-otp').val(mnemonicStr)
      itemInBuf.find('.confirm-oper-otp').keyup({ param1: '#buffer-item-template-' + idxBuffer }, App.isOtpContentDeleted)
      $('#qr-code-stuff').find('.requested-otp-id').text('None');

    itemInBuf.find('.confirm-oper-btn').show()
      $('#buffer-item-template-' + idxBuffer).find('.qr-code-just-scanning').hide()
      $('#qr-code-stuff').hide()
      $('#cam-qr-result').text('');
    App.qrAdapter.qrScanner.stop()
    }
}

window.App = {
  // Some static vars
  accounts: null,
  WalletHandleInstance: null,
  WalletFactoryAddr: null,
  owner: null,
  network: null,
  receiverOfLastResortFunds: null,
  timeoutOfLastResort: null,
  c: null,
  alreadyException: false,
  increasedEVMTime: 0,
  wallet_created_at: null,
  qrAdapter: null,
  defaultAccount: null,

  start: function () {
    TruffleContractWH.setProvider(window.web3.currentProvider)
    TruffleContractWHFactory.setProvider(window.web3.currentProvider)
    makeDirtyHackforWeb3Beta1_0_0()

    App.preloadWalletsIfLocalStorageIsEmpty(PRELOADED_WALLETS_CACHE)
    App.bindEvents()
    App.createExistingWalletsHTML()
    App.loadOrDeployWalletFactoryFromLocalStorage()

    TruffleContractWH.defaults({ from: App.defaultAccount, gas: 7.3 * 1000 * 1000, gasPrice: 20 * 1000000000 })
    TruffleContractWHFactory.defaults({ from: App.defaultAccount, gas: 7.3 * 1000 * 1000, gasPrice: 20 * 1000000000 })

    if (AUTH_MODES.NOAUTH === CUR_AUTH_MODE) {
      console.log("Disabling OTP functionality in subtree's list.")
      $('#buffer-item-template .confirm-oper-otp').attr('placeholder', 'OTPs are disabled in current mode.')
      $('#buffer-item-template .enter-otp-area').hide()
        $('new-subtree-otp').attr('placeholder', 'OTPs are disabled in current mode.')
      $('#new-parent-otp').attr('placeholder', 'OTPs are disabled in current mode.')
    } else {
      $('#buffer-item-template .confirm-oper-otp').attr('disabled', false)
      $('#new-subtree-otp').attr('disabled', false)
      $('#new-parent-otp').attr('disabled', false)
    }

    // initialize QR code scanner
    App.qrAdapter = qrAdapter
      App.qrAdapter.init()

      // if(NETWORKS.ROPSTEN === App.network){
      //   window.ethereum.on('accountsChanged', function (accounts) {
      //     setStatus("Accounts in Metamask changed to:", accounts);
      //     window.alert("Accounts in Metamask changed to:" + accounts);
      //   });
      // }

  },

  refreshAccounts: async () => {
    if (NETWORKS.ROPSTEN === App.network) {
      var _accounts = (undefined != window.ethereum) ? await window.ethereum.enable(): await web3.eth.getAccounts()
        console.log('_accounts = ', _accounts)
        if (_accounts.length == 0) {
        window.alert('Make sure you are logged in your Metamask instance.')
        return
      }
      App.accounts = _accounts
        App.defaultAccount = _accounts[0]
        console.log('All available accounts through Metamask web3:', App.accounts)
      console.log('App.defaultAccount', _accounts[0])

    }else { // local mode
      var _accounts = await web3.eth.getAccounts()
      // if (err != null) {
      //   window.alert('There was an error fetching your accounts: ' + err + "\n\nYou may need to run truffle suite for local mode.")
      //   return
      // }
      if (_accounts.length == 0) {
        window.alert('Couldn\'t get any accounts! Make sure your local Ethereum blockchain is running an configurred properly.')
        return
      }
      App.accounts = _accounts
      App.defaultAccount = _accounts[0]
      console.log('All available accounts through local web3:', App.accounts)
    }
    console.log('App.defaultAccount = ', App.defaultAccount)
  },

  alertAndHalt: function (str) {
    App.alreadyException = true
    if (str.search('is not a contract address') !== -1 || str.search('Cannot create instance of') !== -1) {
      $('#starting-screen').show()
      $('#lifetime-area').hide()
      App.setStatus('-')
      window.alert('Contract does not exist. It was likely destroyed on manual request.')
      throw str
    }
    App.setStatus(str)
    window.alert(str)
    throw str
  },

  bindEvents: function () {
    $('#init-oper-type').change(App.refreshInitOperForm)
    $('#adjust-new-subtree-btn').click(App.adjustNewSubtree)
    $('#confirm-new-parent-tree').click(App.adjustNewParentTree)
    $('#number-of-leaves').change(App.refreshSubtreeLeavesForm)
  },

  setStatus: function (message) {
    $('#status').text(message)
  },

  /// ///////////////////////////////////////////
  /// / Handling of wallet factory contract  ////
  /// ///////////////////////////////////////////

  loadOrDeployWalletFactoryFromLocalStorage: function () {
    if (typeof (Storage) !== 'undefined') {
      if (!isStorageItemDefined(localStorage.getItem('walletFactoryAddr'))) {
        if (NETWORKS.ROPSTEN === App.network) {
          // use harcoded wallet factory that we created beforehand
          console.log('Using pre-deployed wallet factory.')
          App.WalletFactoryAddr = ROPSTEN_WALLET_FACTORY
          $('#factory-address').text(App.WalletFactoryAddr)
          localStorage.setItem('walletFactoryAddr', ROPSTEN_WALLET_FACTORY)
        } else {
          console.log('Local storage was empty -> Setting up a new wallet factory')
          App.deployWalletFactory() // create a new factory
        }
      } else {
        // check whether address of Contract factory from storage really exists
        var conFactory = TruffleContractWHFactory.at(localStorage.getItem('walletFactoryAddr'))
        conFactory.then(function (c) {
          // console.log("c = ", c);
          console.log('Existing wallet factory address found in local storage: ', c.address)
          App.WalletFactoryAddr = localStorage.getItem('walletFactoryAddr')
          $('#factory-address').text(App.WalletFactoryAddr)
        }).catch((error) => {
          // if it does not exist, just create it
          console.log('error = ', error)
          const factoryContractDoesNotExist = error.message.search('no code at address') >= 0
          if (factoryContractDoesNotExist) {
            App.deployWalletFactory() // create a new factory
          } else {
            App.alertAndHalt(error)
          }
        })
      }
    } else {
      window.alert('Sorry, your browser does not support web storage. Switch to another browser, please.')
      throw 'localStorage error'
    }
  },

  deployWalletFactory: function () {
    let self = this

    console.log('deployWalletFactory - App.defaultAccount = ', App.defaultAccount)

    TruffleContractWHFactory.new(
      { from: App.defaultAccount } // just random address
    ).then(function (walletFactory) {
      console.log('Deployed WalletFactory contract with address', walletFactory.address)
      App.WalletFactoryAddr = walletFactory.address
      localStorage.setItem('walletFactoryAddr', walletFactory.address)
      self.setStatus('Wallet factory contract deployed at address: ' + walletFactory.address)
      $('#factory-address').text(walletFactory.address)
    }).catch((error) => {
      console.log(error)
      App.alertAndHalt('Deployment of wallet factory contract was not successful. \n(' + error + ")")
    })
  },

  /// /////////////////////////////////////////////////////
  /// / Handling of exisiting wallets in local storage ////
  /// ////////////////////////////////////////////////////

  preloadWalletsIfLocalStorageIsEmpty (jsonData) {
    console.log('Local storage [existingWallets] = ', localStorage.getItem('existingWallets'))
    console.log('Local storage [walletFactoryAddr] = ', localStorage.walletFactoryAddr)
    if (typeof (Storage) !== undefined) {
      // preload some wallets at the first time
      if ('null' == localStorage.getItem('existingWallets') || 'undefined' == localStorage.getItem('existingWallets') ||
      localStorage.getItem('existingWallets') == null || undefined == localStorage.getItem('existingWallets')) {
        console.log('Local storage was empty -> preloading from a default file')
        localStorage.setItem('existingWallets', JSON.stringify(jsonData))
      } else {
        console.log('Local storage was not empty.')
      }
    } else {
      window.alert('Sorry, your browser does not support web storage. Switch to another browser, please.')
      throw 'localStorage error'
    }
  },

  createExistingWalletsHTML: function () {
    if ('undefined' === localStorage.getItem('existingWallets') || 'null' === localStorage.getItem('existingWallets')) {
      return null
    }

    var data = JSON.parse(localStorage.getItem('existingWallets'))
    var foundWallets = []

    for (let i = 0; i < data.length; i++) {
      // find correct network, check existence and render HTML
      if (data[i].network_name === App.network) {
        console.log('Checking existing wallets of network: ', data[i].network_name)
        for (let j = 0; j < data[i].wallets.length; j++) {
          var wallet = data[i].wallets[j]
          console.log('Found wallet:', wallet)
          foundWallets.push(wallet)
        }
        break
      } else {
        continue // TODO: remove non-existing wallet from cache?? Maybe no.
      }
    }
    console.log('foundWallets', foundWallets)
    return App.buildExistingWallets(foundWallets)
  },

  buildExistingWallets: function (foundWallets) {
    var promises = []

    for (let i = 0; i < foundWallets.length; i++) {
      const wallet = foundWallets[i]
      console.log('checking existence of wallet at address: ', wallet.address)

      var con = TruffleContractWH.at(wallet.address)
      var pr = con.then(function (c) {
        console.log('wallet exists: ...at address: ', c)
        foundWallets.forEach(w => {
          if (c.address.toLowerCase() === w.address) {
            web3.eth.getBalance(w.address).then(function (balance) {
              App.createAnExistingWalletHTML(w, balance)
            })
          }
        })
        promises.push(pr)
      }).catch((error) => {
        console.log('Wallet does not exist:', error.message)
      })
    }
    return promises
  },

  createAnExistingWalletHTML: function (wallet, balance) {
    console.log('Rendering wallet: ', wallet)
    var itemTemplate = $('#existing-wallet-template')

    var item = itemTemplate.clone()
    item.find('.name').text(wallet.name)
    item.find('.address').text(wallet.address)
    item.find('.owner').text(wallet.owner)
    item.find('.created-at').text(wallet.created_at)
    item.find('.balance').text(parseFloat(balance) / ETH_TO_WEI)
    item.find('.leaves').text(wallet.leaves)
    item.find('.subtree-leaves').text(wallet.subtree_leaves)
    item.find('.hash-chain').text(wallet.hash_chain_len)
    item.find('.parent-tree-idx').text(wallet.parent_tree_idx)
    item.attr('id', 'existing-wallet-template-' + wallet.address)
    if (AUTH_MODES.HWAUTH == CUR_AUTH_MODE) {
      item.find('.seed-mnem-existing-wallet').hide()
    } else {
      item.find('.seed-mnem-existing-wallet').show()
    }

    item.find('.btn-use').click(
      { param1: wallet.address,
        param2: wallet.leaves,
        param3: wallet.subtree_leaves,
        param4: wallet.hash_chain_len,
        param5: wallet.parent_tree_idx,
        param6: wallet.created_at,
        param7: (AUTH_MODES.HWAUTH == CUR_AUTH_MODE) ? wallet.leaves_data: null,
        param8: wallet.owner,
        param9: APPLY_WALLET.FROM_LOCAL_STORAGE
      }, App.applyExistingWallet
    )
    item.show()
    item.appendTo('#existing-wallets')
    // $("#btn-delete-wallets-from-storage").show()
  },

  importWalletByAddress: async () => {
    var addr = validateAddress($('#imported-address').val(), 'imported-address');
    console.log('addr = ', addr)

    try {
      var con = await TruffleContractWH.at(addr)
      var event = {
        data: {
          param1: addr,
          param2: await con.MT_parent_numberOfOTPs.call(),
          param3: await con.MT_child_numberOfOTPs.call(),
          param4: await con.MT_hash_chain_len.call(),
          param5: await con.MT_parent_currentParentTreeIdx.call(),
          param6: null,
          param7: null, // this will cause creation of new leaves data in the authenticator
          param8: await con.owner.call(),
          param9: APPLY_WALLET.FROM_ADDRESS
        }
      }
      App.applyExistingWallet(event) // misue existing method that uses data from local storage
    } catch (error) {
      console.log(error.message)
      throw error
    }
  },

  applyExistingWallet: function (event) {
    console.log('applyExistingWallet', event)
    var addrOfWallet = event.data.param1

    // do not provide seed if we are in HW AUTH mode and loading wallet from local storage ; just initialize from client storage instead
    var mnemonicOfSeed = (APPLY_WALLET.FROM_LOCAL_STORAGE == event.data.param9)
      ? (AUTH_MODES.HWAUTH !== CUR_AUTH_MODE) ? validateMnemonicAndGetItsValue('#existing-wallet-template-' + addrOfWallet + ' .seed-mnem-existing-wallet') : null
      : validateMnemonicAndGetItsValue('#seed-mnem-imported-wallet');

    mtAdapter.init(
      validateAndGetNumberOfLeaves(event.data.param2), // parent leaves
      validateAndGetNumberOfLeaves(event.data.param3), // subtree leaves
      validateNaturalNumber(event.data.param4, 'hash chain length'),
      validatePositiveInt(event.data.param5, 'index of parent tree'),
      mnemonicOfSeed,
      event.data.param7 // client storage
    )
    var con = TruffleContractWH.at(addrOfWallet)
    con.then(function (walletSC) {
      console.log('Applied existing WalletHandle contract with address', walletSC.address)
      App.WalletHandleInstance = walletSC
      return App.updateInfoOfExistingWallet(con)
    }).then(function (rootHashContract) {
      if (rootHashContract !== mtAdapter.auth.MT_parent_rootHash) {
        throw `Root hash of wallet is ${rootHashContract} and derived root hash from client storage is ${mtAdapter.auth.MT_parent_rootHash}.`
      }
      updatePageAfterDeploy(
        mtAdapter.auth.MT_parent_rootHash, mtAdapter.auth.MT_parent_numberOfOTPs, App.owner, App.receiverOfLastResortFunds,
        App.timeoutOfLastResort, mtAdapter.auth.MT_parent_height, addrOfWallet
      )
      App.wallet_created_at = event.data.param6
      App.increasedEVMTime = 0
      if (App.owner != event.data.param8.toLowerCase()) {
        throw `Owner of wallet fetched from local storage (${event.data.param8}) is different than the one from the blockchain (${App.owner}).`
      }
      $('#lifetime-area').show()
      $('#init-oper').show()
      $('#init-oper-type').val('-1')
      hideStartingScreen()
      App.createBufferHTML()
      App.bindOperationBufferEvents()
      App.refreshBuffer(true)
      App.updateInfoArea()
      App.setStatus('Existing wallet contract fetched from blockchain.')

      if (APPLY_WALLET.FROM_ADDRESS == event.data.param9) { // in the case of importing the wallet from address, store to local storage
        App.saveNewWalletToLocalStorage(addrOfWallet, 'Wallet ' + addrOfWallet.substr(0, 7), mtAdapter.auth.MT_parent_numberOfLeafs,
          mtAdapter.auth.MT_child_numberOfLeafs, mtAdapter.auth.Hashchain_len
        )
        $('#imported-address').val('');
        $('#seed-mnem-imported-wallet').val('');
      }

      setInterval(App.refreshBufferAndupdateInfoArea, REFRESH_TIMEOUT) // set refresh timeout

    }).catch((error) => {
      console.log(error)
      App.alertAndHalt('Fetching of existing contract was not successful. \n(' + error + ")")
    })
  },

  updateInfoOfExistingWallet: function (con) {
    var conTmp

    return con.then(function (c) {
      conTmp = c
      return c.owner.call()
    }).then(function (owner) {
      App.owner = owner.toString().toLowerCase()
      return conTmp.lastResort.call()
    }).then(function (recvLastRes) {
      App.receiverOfLastResortFunds = recvLastRes[0].toString()
      App.timeoutOfLastResort = BigInt(recvLastRes[2])
      return conTmp.dailyLimits.call()
    }).then(function (dLims) {
      App.dailyLimit = BigInt(dLims[0])
      return conTmp.getCurrentOtpID.call()
    }).then(function (otpID) {
      mtAdapter.currentSubtreeIdx = Math.floor(otpID.toNumber() / mtAdapter.auth.MT_child_numberOfOTPs)
      // mtAdapter.auth._sequenceNoOfParentTree = Math.floor(otpID.toNumber() / mtAdapter.auth.MT_parent_numberOfOTPs) + 1;
      return conTmp.MT_parent_rootHash.call()
    })
  },

  saveNewWalletToLocalStorage: function (_addr, _name, _leaves, _subtree_leaves, _hash_chain_len) {
    var newWallet = {
      address: _addr.toLowerCase(),
      name: _name,
      leaves: _leaves,
      subtree_leaves: _subtree_leaves,
      hash_chain_len: _hash_chain_len,
      parent_tree_idx: 0, // default when wallet was created
      created_at: new Date().toLocaleString(),
      leaves_data: mtAdapter.auth.MT_parent_storageOfLeafs,
      owner: App.owner
    }
    App.wallet_created_at = newWallet.created_at
    var storedWallets = JSON.parse(localStorage.getItem('existingWallets'))
    var alreadyExists = false

    for (let i = 0; i < storedWallets.length; i++) {
      if (storedWallets[i].network_name === App.network) {
        storedWallets[i].wallets.forEach(w => {
          if (w.address === newWallet.address && w.created_at === newWallet.created_at) {
            alreadyExists = true
            console.log('Wallet already exists in local storage.')
          }
        })
        if(!alreadyExists) {
          storedWallets[i].wallets.push(newWallet)
          console.log('Adding a new wallet to local storage', storedWallets[i])
        }
        break
      }
    }
    localStorage.setItem('existingWallets', JSON.stringify(storedWallets))
    // console.log("new local storage is: ". localStorage.getItem('existingWallets'));
  },

  updateWalletInLocalStorage: function (address, _parent_tree_idx) {
    var storedWallets = JSON.parse(localStorage.getItem('existingWallets'))

    var alreadyFound = false
    for (let i = 0; i < storedWallets.length; i++) {
      if (storedWallets[i].network_name === App.network) {
        storedWallets[i].wallets.forEach(w => {
          if (w.address === address) {
            if (w.parent_tree_idx === _parent_tree_idx) {
              App.alertAndHalt('w.parent_tree_idx === _parent_tree_idx')
            }
            w.parent_tree_idx = _parent_tree_idx
            w.leaves_data = mtAdapter.auth.MT_parent_storageOfLeafs
            alreadyFound = true
          }
        })
        if(alreadyFound)
          {break}
      }
    }
    console.log('Updating an existing wallet to local storage: new parent tree idx = ', _parent_tree_idx)
    console.log('existingWallets = ', storedWallets)
    localStorage.setItem('existingWallets', JSON.stringify(storedWallets))
  },

  deleteWalletInLocalStorage: function (address, created_at) {
    var storedWallets = JSON.parse(localStorage.getItem('existingWallets'))
    var newWallets = []

    for (let i = 0; i < storedWallets.length; i++) {
      if (storedWallets[i].network_name === App.network) {
        storedWallets[i].wallets.forEach(w => {
          if (w.address !== address && created_at !== w.created_at) {
            newWallets.push(w)
          }
        })
      }
    }
    console.log('Deleting destroyed wallet, existingWallets = ', storedWallets)
    localStorage.setItem('existingWallets', JSON.stringify(newWallets))
  },

  deleteAllWalletsFromStorage: function () {
    if (typeof (Storage) !== undefined) {
      localStorage.setItem('existingWallets', null)
      localStorage.setItem('walletFactoryAddr', null)
      $('#existing-wallets').hide()
      // $("#btn-delete-wallets-from-storage").hide()
      App.preloadWalletsIfLocalStorageIsEmpty(PRELOADED_WALLETS_CACHE)
    }
  },

  /// ////////////////////////////////
  /// / Information area actions  ////
  /// ////////////////////////////////

  sendToLastResortAddrAfterTimeout: function () {
    console.log(`Sending all crypto-tokens to the last resort address ${App.receiverOfLastResortFunds}.`)

    var con = TruffleContractWH.at(App.WalletHandleInstance.address)
    var cc
    con.then(function (c) {
      cc = c
      return cc.sendFundsToLastResortAddress({ from: App.owner })
    }).then(function (reciept) {
      console.log('reciept = ', reciept)
      App.setStatus('Contract destroyed by sending funds to last resort address.')
      App.deleteWalletInLocalStorage(App.WalletHandleInstance.address, App.wallet_created_at)
      App.alertAndHalt(`Contract was destroyed and ${App.WalletHandleInstance.address} is not a contract address anymore.`)
    }).catch((error) => {
      if (App.alreadyException) { App.alreadyException = false; return }
      App.alertAndHalt('Sending funds to last resort address was not successfull. \n(' + error.message + ")")
    })
  },

  increaseEVMtimeBy1Day: async () => {
    console.log('Increasing EVM time by 1 day')
    var one_day = 24 * 3600
    var res = await increaseTime(one_day)
    // console.log("increaseTime = ", res)
    App.increasedEVMTime += 1
    App.updateInfoArea()
  },

  depositAssetsToContract: function () {
    let self = this
    if (App.WalletHandleInstance == null) {
      window.alert('Smart contract is not deployed yet.')
      return
    }
    this.setStatus('Depositing funds to contract...')
    $('#status-waiting-for-blockchain').show()
    web3.eth.sendTransaction({
      from: App.defaultAccount,
      to: App.WalletHandleInstance.address,
      value: 0.3 * Math.pow(10, 18)
    }).then(function (args) {
      self.updateInfoArea()
      self.setStatus('Transaction complete!')
      $('#status-waiting-for-blockchain').hide()
      $('#deposit-assets-to-contract').attr('disabled', false)
    })
  },

  refreshBufferAndupdateInfoArea: function () {
    App.refreshBuffer()
    App.updateInfoArea()
  },

  updateInfoArea: async () => {
    if (App.WalletHandleInstance != null) {
      console.log('App.WalletHandleInstance.address = ', App.WalletHandleInstance)
      var bal = await web3.eth.getBalance(App.WalletHandleInstance.address)
      $('#balance').text(parseFloat(bal.valueOf().toString()) / ETH_TO_WEI)

      var currentOtpID = await App.WalletHandleInstance.getCurrentOtpID.call()
      var remainingOTPs = mtAdapter.auth.MT_parent_numberOfOTPs - currentOtpID.toNumber() - 1
      $('#remaining-OTPs').text(remainingOTPs)
      if (remainingOTPs === 4) {
        // alert("You have last 4 OTPs in parent tree.")
        App.setStatus('You have last 4 OTPs in parent tree.');
        $('#remaining-OTPs').css('color', 'red')
      } else if (remainingOTPs === 0) {
        $('#init-oper').hide()
        $('#new-parent-tree-area').show()
      }

      var dailyLimits = await App.WalletHandleInstance.dailyLimits.call()
      var dailyLimitBN_Limit = parseFloat(dailyLimits[0].toString())
      var dailyLimitBN_alreadySpent = parseFloat(dailyLimits[1].toString())

      if(dailyLimitBN_Limit !== 0.0) {
        $('#daily-limit-value').text(parseFloat(dailyLimitBN_Limit.toString()) / ETH_TO_WEI) // here add unlimited precision
        var availableToSpend = parseFloat((dailyLimitBN_Limit - dailyLimitBN_alreadySpent).toString()) / ETH_TO_WEI
        $('#daily-limit-available-to-spent').text((availableToSpend >= 0) ? availableToSpend : 0.0)
      } else {
        $('#daily-limit-value').text('-')
        $('#daily-limit-available-to-spent').text('-')
      }

      var lastResInfo = await App.WalletHandleInstance.lastResort.call()
      $('#last-resort-addr').text(lastResInfo[0])

      if (lastResInfo[2].toNumber() == 0) {
        $('#last-resort-timeout').text('-')
        $('#last-resort-remaining-days').text('-')
      } else {
        var remaining = lastResInfo[2].toNumber() - (Math.floor(Date.now() / (24 * 3600 * 1000) + App.increasedEVMTime) - lastResInfo[1].toNumber())
        $('#last-resort-remaining-days').text(remaining)
        $('#last-resort-timeout').text(lastResInfo[2])
        if (remaining <= 0) {
          $('#last-resort-remaining-days').css('color', 'red').css('font-weight', 'bold')
          alert('You can already send all crypto-tokens to the last resort address.')
          $('#btn-send-to-last-resort-addr').show()
        } else {
          $('#btn-send-to-last-resort-addr').hide()
        }
      }
    }
  },

  /// ///////////////////////////////////////
  /// / Handling of displayed operations ////
  /// ///////////////////////////////////////

  initOper: async () => {
    var params = prepareAndvalidateInitOperParams()
    var operType = params[0]
    var operParam = params[1]
    var operAddress = params[2]
    await App.refreshAccounts()
    console.log('validate init oper: type = ', parseInt(operType, 10), ', param = ', operParam, ', address = ', operAddress)
    console.log('owner = ', App.owner)
    checkDepletedOTPs()

    if (App.network == NETWORKS.ROPSTEN) { // check whether the user has correct account selected in Metamask
      var _accounts = await window.ethereum.enable()
      if(App.owner != _accounts[0]) {
        App.alertAndHalt(`Please select the owner account (${App.owner}) in Metamask`)
      }
    }

    var cc = await TruffleContractWH.at(App.WalletHandleInstance.address)

    var idInBuffer
    var item

    var currentOtpID = await cc.getCurrentOtpID.call() // update status of initiated operation
    idInBuffer = ((currentOtpID) % mtAdapter.auth.MT_child_numberOfOTPs).toString()
    console.log('initOper -> idInBuffer', idInBuffer)
    item = $('#buffer-item-template-' + idInBuffer)
    item.find('.waiting-for-blockchain').show()

    let promise = cc.initNewOper(operAddress, operParam, operType, { from: App.owner })
    promise.then(function (reciept) {
      console.log('reciept = ', reciept)
      item.find('.waiting-for-blockchain').hide()
      App.setStatus('Operation initiated.')
      App.updateInfoArea()
      App.refreshBuffer()
      $('#init-oper-type').val('-1')
      $('#wrapper-init-oper-param').hide()
      $('#wrapper-init-oper-address').hide()
    }).catch((error) => {
      App.alertAndHalt('Init of operation was not succesful. \n(' + error.message + ")")
    });
  },

  confirmOper: function (event) {
    event.preventDefault()
    App.alreadyException = false
    App.refreshAccounts()
    var image = $('#qr-code-video');
    QrScanner.scanImage(image)
      .then(result => console.log(result))
      .catch(error => console.log(error || 'No QR code found.'))


    var idxInSubtree = event.data.param1
    var item = $('#buffer-item-template-' + idxInSubtree.toString())
    var OTP = item.find('.confirm-oper-otp').val()
    var OtpElemId = '#buffer-item-template-' + idxInSubtree.toString() + ' .confirm-oper-otp'
    var otpID = event.data.param1 + mtAdapter.getOffsetOfCurrentSubtree()
    item.find('.waiting-for-blockchain').show()
    item.find('.confirm-oper-otp').attr('disabled', true)
    item.find('.confirm-oper-btn').attr('disabled', true)
    console.log('confirmOper.idxInSubtree = ', idxInSubtree, ' | OTP = ', OTP, ' | otpID = ', otpID)

    var cc
    var con = TruffleContractWH.at(App.WalletHandleInstance.address)
    con.then(function (c) {
      cc = c
      return c.pendingOpers.call(otpID)
    }).then(function (oper) {
      if (OPER.TRANSFER === oper[3]) {
        validateBalanceAndLimits(parseFloat(oper[1].toString()) / ETH_TO_WEI)
      }
      return cc.confirmOper(...mtAdapter.getConfirmMaterial(otpID, OtpElemId), otpID, { from: App.defaultAccount })
    }).then(function (reciept) {
      item.find('.waiting-for-blockchain').hide()
      item.find('.confirm-oper-otp').attr('disabled', false).hide()
      item.find('.confirm-oper-btn').attr('disabled', false).hide()
      console.log('confirmOper.reciept = ', reciept)

      item.find('.enter-otp-area').show()
      item.find('.confirm-oper-otp').val('')
      item.find('.buffer-item-confirm-stuff').hide()
      App.updateInfoArea()
      App.refreshBuffer()
      if (item.find('.buffer-content').text().search('DESTRUCT') !== -1) {
        App.alertAndHalt(App.WalletHandleInstance.address + ' is not a contract address')
      }
    }).catch((error) => {
      item.find('.waiting-for-blockchain').hide()
      item.find('.confirm-oper-otp').attr('disabled', false)
      item.find('.confirm-oper-btn').attr('disabled', false)
      if (App.alreadyException) { App.alreadyException = false; return }
      App.alertAndHalt('Operation was not confirmed. \n(' + error.message + ")")
    })
  },

  createBufferHTML: function () {
    var itemTemplate = $('#buffer-item-template')

    for (var i = 0; i < mtAdapter.auth.MT_child_numberOfOTPs - 1; i++) {
      var item = itemTemplate.clone()
      item.show()
      item.find()
      item.attr('id', 'buffer-item-template-' + i.toString())
      item.appendTo('#buffer-list')
    }
  },

  bindOperationBufferEvents: function () {
    for (var i = 0; i < mtAdapter.auth.MT_child_numberOfOTPs; i++) {
      var item = $('#buffer-item-template-' + i.toString())
        item.find('.confirm-oper-btn').click({ param1: i }, App.confirmOper)
      item.find('.enter-otp-qr').click({ param1: i }, App.qrAdapter.scan)
      item.find('.enter-otp-mnemonic').click({ param1: i }, function (event) {
        event.preventDefault()
          var itemInBuffer = '#buffer-item-template-' + event.data.param1
          $(itemInBuffer + ' .confirm-oper-otp').show().attr('disabled', false)
          console.log('.enter-otp-mnemonic: ', itemInBuffer + ' .confirm-oper-otp');
        $(itemInBuffer + ' .enter-otp-area').hide()
          $(itemInBuffer + ' .confirm-oper-btn').show()
          $(itemInBuffer + ' .confirm-oper-otp').keyup({ param1: itemInBuffer }, App.isOtpContentDeleted)
        });
    }
  },

  refreshInitOperForm: function (event) {
    event.preventDefault()

    var typeParam = parseInt($('#init-oper-type option:selected').val(), 10)
    console.log('operType = ', typeParam)

    switch (typeParam) {
      case OPER.TRANSFER:
        console.log('OPER.TRANSFER')
        $('#wrapper-init-oper-param').show().find('#init-oper-param-label').text('Amount to transfer: ')
        $('#wrapper-init-oper-address').show().find('#init-oper-address-label').text('Recipient: ')
        break
      case OPER.LAST_RES_TIMEOUT:
        $('#wrapper-init-oper-param').show().find('#init-oper-param-label').text('Timeout for last resort functionality in days: ')
        $('#wrapper-init-oper-address').hide()
        break
      case OPER.DAILY_LIMIT:
        $('#wrapper-init-oper-param').show().find('#init-oper-param-label').text('Daily Limit: ')
        $('#wrapper-init-oper-address').hide()
        break
      case OPER.LAST_RES_ADDR:
        $('#wrapper-init-oper-param').hide()
        $('#wrapper-init-oper-address').show()
        break
      case OPER.DESTRUCT:
      default:
        $('#wrapper-init-oper-param').hide()
        $('#wrapper-init-oper-address').show()
        break;
    }
  },

  clearBuffer: function () {
    for (var k = 0; k < mtAdapter.auth.MT_child_numberOfOTPs - 1; k++) {
      var item = $('#buffer-item-template-' + k.toString())
      item.find('.buffer-otpid-wrapper').hide()
      item.find('.buffer-item-confirm-stuff').hide()
      item.find('.confirm-oper-otp').text('')
      item.find('.oper-already-executed').hide()
      item.find('.buffer-otpid-wrapper').css('color', 'black')
      item.find('.buffer-content').text('Empty Position').css('color', 'black')

      if (AUTH_MODES.HWAUTH === CUR_AUTH_MODE) {
        item.find('.confirm-oper-otp').attr('disabled', false)
      }
    }
  },

  refreshBuffer: function (fullRefresh = false) { // if fullRefresh is true, than check all items from blockchain; otherwise only the last one
    var con = TruffleContractWH.at(App.WalletHandleInstance.address)
    var promises = []
    var c

    con.then(function (cc) {
      c = cc
      return c.getCurrentOtpID.call()
    }).then(function (topInd) {
      console.log('refreshBuffer.topInd = ', topInd.toNumber())

      // render HTML of updated operations (all OR the last one)
      var startIdx = (topInd.toNumber() == 0) ? 0 : topInd.toNumber() - 1
      startIdx = (fullRefresh) ? 0 : startIdx % mtAdapter.auth.MT_child_numberOfOTPs

      for(var i = startIdx; i < (topInd.toNumber() % mtAdapter.auth.MT_child_numberOfOTPs); i++) {
        promises.push(c.pendingOpers.call(i + mtAdapter.getOffsetOfCurrentSubtree()))
      }
      Promise.all(promises).then(function (resultsOfPromises) {
        for (var k = startIdx; k < (topInd.toNumber() % mtAdapter.auth.MT_child_numberOfOTPs); k++) {
          buildElementInBuffer(resultsOfPromises[k - startIdx], k, topInd.toNumber())
        }
      })

      // render HTML of invalidated operations from the prev iteration layer (if the last operation is the 1st one the new iteration layer)
      App.renderInvalidatedOperations(topInd.toNumber())
    });
  },

  renderInvalidatedOperations: function (topInd) {
    var leafIdxOfLastInitOper = ((topInd - 1) % mtAdapter.auth.MT_child_numberOfOTPs) % mtAdapter.auth.MT_child_numberOfLeafs
    var hashLevelOfLastOper = Math.floor(((topInd - 1) % mtAdapter.auth.MT_child_numberOfOTPs) / mtAdapter.auth.MT_child_numberOfLeafs)
    console.log(`leafIdxOfLastInitOper = ${leafIdxOfLastInitOper} and hashLevelOfLastOper = ${hashLevelOfLastOper}`)
    if(leafIdxOfLastInitOper == 0) {
      for (var k = mtAdapter.auth.MT_child_numberOfLeafs * (hashLevelOfLastOper - 1); k < (mtAdapter.auth.MT_child_numberOfLeafs * (hashLevelOfLastOper - 1) + mtAdapter.auth.MT_child_numberOfLeafs); k++) {
        console.log('rendering invalidated item', k)
        var item = $('#buffer-item-template-' + k.toString())
        item.find('.is-invalidated').show()
        item.find('.confirm-oper-btn').attr('disabled', true)
        item.find('.confirm-oper-otp').attr('disabled', true)
        item.css('color', 'grey')
      }
    }
  },

  isOtpContentDeleted: function (event) {
    var bufferItem = $(event.data.param1)
    // console.log(bufferItem.find(".confirm-oper-otp").val());
    if('' == bufferItem.find('.confirm-oper-otp').val()) { // if OTP input area is empty than display input buttons
      bufferItem.find('.enter-otp-area').show()
      bufferItem.find('.confirm-oper-otp').hide()
      bufferItem.find('.confirm-oper-btn').hide()
    }
  },

  /// /////////////////////////////////
  /// / Actions for depleted OTPs  ////
  /// /////////////////////////////////

  adjustNewSubtree: function (event) {
    event.preventDefault()
    App.alreadyException = false

    var con = TruffleContractWH.at(App.WalletHandleInstance.address)
    var OtpElemId = '#new-subtree-otp';
    var cc = null
    con.then(function (c) {
      cc = c
      return c.getCurrentOtpID.call()
    }).then(function (curentOTPId) {
      console.log('OtpID4NewSubtree = ', curentOTPId.toNumber())
      $('#new-subtree-otp-area').find('.waiting-for-blockchain').show()
      var newChildTreeIdx = mtAdapter.currentSubtreeIdx + 1
      return cc.adjustNewChildTree(
        mtAdapter.auth.MT_child_depthOfCachedLayer, mtAdapter.auth.getChildCachedLayer(newChildTreeIdx),
        ...mtAdapter.auth.getAuthPath4ChildTree(newChildTreeIdx),
        ...mtAdapter.getConfirmMaterial(curentOTPId.toNumber(), OtpElemId),
        { from: App.owner }
      )

    }).then(function (reciept) {
      $('#new-subtree-otp-area').find('.waiting-for-blockchain').hide()
      console.log('adjustNewSubtree.reciept = ', reciept)
      noDepletedChildOTPs()
      $('#init-oper').show()
      mtAdapter.currentSubtreeIdx += 1
      App.clearBuffer()
      App.updateInfoArea()
      App.setStatus('New parent subtree introduced successfully.')

      App.refreshBuffer(true)
    }).catch((error) => {
      if (App.alreadyException) { App.alreadyException = false; return }
      App.alertAndHalt('Introduction of a new subtree was not succesfull. \n(' + error.message + ")")
    })
  },

  adjustNewParentTree: function (event) {
    event.preventDefault()
    App.alreadyException = false

    // prefetch proof from the old tree and shift to the next parent tree
    var otpAndProof = mtAdapter.getConfirmMaterial(mtAdapter.auth.MT_parent_numberOfOTPs - 1, "#new-parent-otp")
    mtAdapter.generateNextParentTree(validateMnemonicAndGetItsValue('#new-parent-auth-seed'))

    var cc = null
    var con = TruffleContractWH.at(App.WalletHandleInstance.address)

    con.then(function (c) {
      cc = c

      // stage 1
      var hashOfRootAndOTP = h(concatB32(mtAdapter.auth.MT_parent_rootHash, otpAndProof[0][0]))
      return cc.adjustNewParentTree_stage1(hashOfRootAndOTP, { from: App.owner })
    }).then(function (receipt) {
      console.log('adjustNewParentTree_stage1.receipt = ', receipt)

      // stage 2
      return cc.adjustNewParentTree_stage2(mtAdapter.auth.MT_parent_rootHash, { from: App.owner })
    }).then(function (reciept) {
      console.log('adjustNewParentTree_stage2.reciept = ', reciept)

      // stage 3
      return cc.adjustNewParentTree_stage3(...otpAndProof, mtAdapter.auth.MT_child_depthOfCachedLayer,
        mtAdapter.auth.getChildCachedLayer(0), ...mtAdapter.auth.getAuthPath4ChildTree(0), { from: App.owner }
      )
    }).then(function (reciept) {
      console.log('adjustNewParentTree_stage3.reciept = ', reciept)

      updatePageAfterDeploy(
        mtAdapter.auth.MT_parent_rootHash, mtAdapter.auth.MT_parent_numberOfOTPs, App.owner, App.receiverOfLastResortFunds,
        App.timeoutOfLastResort, mtAdapter.auth.MT_parent_height, App.WalletHandleInstance.address
      )
      App.updateInfoArea()
      App.clearBuffer()
      noDepletedParentOTPs()
      $('#init-oper').show()
      App.updateWalletInLocalStorage(App.WalletHandleInstance.address, mtAdapter.auth.MT_parent_tree_idx)
      App.setStatus('New parent tree introduced successfully.')
    }).catch((error) => {
      if (App.alreadyException) { App.alreadyException = false; return }
      App.alertAndHalt('Introduction of a new parent tree was not succesfull. \n(' + error.message + ")")
    })
  },

  /// ///////////////////////////
  /// / Deploy form actions  ////
  /// ///////////////////////////

  deployContract: function () {
    var self = this
    App.refreshAccounts() // refreshes actual account list available through Metamask
    App.validateAndStoreBootstrapingData()
    mtAdapter.init(
      validateAndGetNumberOfLeaves($('#number-of-leaves').val()),
      validateAndGetNumberOfLeaves($('#number-of-subtree-leaves').val()),
      validateNaturalNumber($('#hash-chain-len').val(), 'hash chain length'),
      0, // 1st parent tree index
      validateMnemonicAndGetItsValue('#seed-mnem-str'),
      null // do not provide client storage and init from seed
    )
    console.log('Deploying WalletHandle contract to network', App.network, 'from', App.owner)
    console.log('\t --height of parent MT is ', mtAdapter.auth.MT_parent_height,
      ";\n\t --height of child MT is ", mtAdapter.auth.MT_child_height,
      ";\n\t --length of hash chain is ", mtAdapter.auth.Hashchain_len,
      ";\n\t --daily limit is ", App.dailyLimit,
      ";\n\t --the parent root hash is ", mtAdapter.auth.MT_parent_rootHash,
      ";\n\t --the first child root hash is ", mtAdapter.auth.MT_parent_layerOfChildRootHashes[0],
      ";\n\t --the number of parent leafs is ", mtAdapter.auth.MT_parent_numberOfLeafs,
      ";\n\t --the number of child leafs is ", mtAdapter.auth.MT_child_numberOfLeafs,
      ";\n\t --the number of parent OTPs is ", mtAdapter.auth.MT_parent_numberOfOTPs,
      ";\n\t --the number of child OTPs is ", mtAdapter.auth.MT_child_numberOfOTPs,
      ";\n\t --last resort address is ", App.receiverOfLastResortFunds,
      ";\n\t --depth of child cached layer is ", mtAdapter.auth.MT_child_depthOfCachedLayer,
      ";\n\t --cached layer of child MT is:\n", mtAdapter.auth.getChildCachedLayer(0)
    )

    $('#deploy-form-message').show()
    $('#deploy-form-input').children().prop('disabled', true)

    if (App.network == NETWORKS.ROPSTEN) {
      App._deployContract(self)
    }else { // simulate waiting for deploymnt if we are on local blockchain
      setTimeout(
        App._deployContract, 2000, self
      )
    }
  },

  _deployContract: async (self) => {
    try {
      var conFactory = await TruffleContractWHFactory.at(App.WalletFactoryAddr)

      var receipt = await conFactory.createWalletHandle(
        mtAdapter.auth.MT_parent_rootHash,
        mtAdapter.auth.MT_parent_height,
        mtAdapter.auth.MT_child_height,
        mtAdapter.auth.MT_child_depthOfCachedLayer,
        mtAdapter.auth.getChildCachedLayer(0),
        ...mtAdapter.auth.getAuthPath4ChildTree(0),
        mtAdapter.auth.Hashchain_len,
        App.dailyLimit,
        App.receiverOfLastResortFunds,
        App.timeoutOfLastResort,
        { from: App.owner, gas: 7.9 * 1000 * 1000 }
      )

      console.log('Deployed WalletHandle contract with address', receipt.logs[0].args.newAddress)
      var walletSC = await TruffleContractWH.at(receipt.logs[0].args.newAddress)

      $('#deploy-form-message').hide()
      $('#deploy-form-input').children().prop('disabled', false)
      App.WalletHandleInstance = walletSC
      App.increasedEVMTime = 0
      updatePageAfterDeploy(
        mtAdapter.auth.MT_parent_rootHash, mtAdapter.auth.MT_parent_numberOfOTPs, App.owner, App.receiverOfLastResortFunds,
        App.timeoutOfLastResort, mtAdapter.auth.MT_parent_height, walletSC.address
      )
      self.updateInfoArea()
      $('#lifetime-area').show()
      hideStartingScreen()
      App.createBufferHTML()
      App.bindOperationBufferEvents()
      App.refreshBuffer()

      self.setStatus('Contract deployed.')
      App.saveNewWalletToLocalStorage(walletSC.address, 'Wallet ' + walletSC.address.substr(0, 7), mtAdapter.auth.MT_parent_numberOfLeafs,
        mtAdapter.auth.MT_child_numberOfLeafs, mtAdapter.auth.Hashchain_len
      )
      setInterval(App.refreshBufferAndupdateInfoArea, REFRESH_TIMEOUT) // set refresh timeout
    } catch (error) {
      console.log(error)
      $('#deploy-form-message').hide()
      $('#deploy-form-input').children().prop('disabled', false)
      throw error
      // App.alertAndHalt("Deployment of contract was not successful. \n(" + error +")");
    }
  },

  prefillAdditionalInputsOfDeploy: function () {
    App.refreshAccounts()
    console.log('App.accounts = ', App.refreshAccounts())
    $('#daily-limit-init').val('0')
    $('#last-res-timeout-init').val(DEFAULT_LAST_RES_TIMEOUT)

    $('#last-res-addr-init').val(DEFAULT_LAST_RESORT_ADDR.toLowerCase())
    $('#owner-addr-init').val(App.defaultAccount.toLowerCase())

    this.setStatus('Defaults prefilled for network ' + App.network)
  },

  validateAndStoreBootstrapingData: function () {
    App.owner = validateAddress($('#owner-addr-init').val(), 'owner')
    App.receiverOfLastResortFunds = validateAddress($('#last-res-addr-init').val(), 'last resort address')
    App.timeoutOfLastResort = validatePositiveInt($('#last-res-timeout-init').val(), 'timeout in days')
    App.dailyLimit = validatePositiveFloat($('#daily-limit-init').val(), 'daily limit') * ETH_TO_WEI
  },

  refreshSubtreeLeavesForm: function (event) {
    event.preventDefault()
    var parentLeaves = validateAndGetNumberOfLeaves($('#number-of-leaves').val())
    $('#number-of-subtree-leaves').val(parentLeaves / SUBTREES_DEFAULT_RATIO)
  },

}

/// ////////////////////
/// / AUX functions ////
/// ////////////////////

function checkDepletedOTPs () {
  if (parseInt($("#remaining-OTPs").text()) === 0) {
    $('#new-parent-tree-area').show()
  }
}

function hideStartingScreen () {
  $('#starting-screen').hide()
  $('#mnemStr-mnem-str').val('')
  $('#number-of-leaves').val('')
  $('#hash-chain-len').val('')
  $('#seed-mnem-str').val('')
  $('#owner-addr-init').val('')
  $('#daily-limit-init').val('')
  $('#last-res-timeout-init').val('')
  $('#last-res-addr-init').val('')
}

function buildElementInBuffer (operation, i, topIndOfOperations) {
  var addr = operation[0]
  var otpID = i + mtAdapter.getOffsetOfCurrentSubtree()
  var userDisplayedOtpId = otpID + 1
  var param = operation[1]
  var pending = operation[2]
  var type = operation[3]
  var toAppend = ''
  var item = $('#buffer-item-template-' + i.toString())
  console.log('buildElementInBuffer.operation = ', operation, 'i = ', i)

  switch (parseInt(type, 10)) {
    case OPER.TRANSFER:
      toAppend += ' TRANSFER | recepient = ' + addr + ' | amount = ' + parseFloat(param) / ETH_TO_WEI
      break;
    case OPER.LAST_RES_TIMEOUT:
      toAppend += ' SET LAST RESORT TIMEOUT | value = ' + param + ' days'
      break
    case OPER.DAILY_LIMIT:
      toAppend += ' SET DAILY LIMIT | value = ' + parseFloat(param) / ETH_TO_WEI + ' ETH'
      break
    case OPER.LAST_RES_ADDR:
      toAppend += ' SET LAST RESORT ADDRESS | recepient = ' + addr
      break
    case OPER.DESTRUCT:
      toAppend += ' DESTRUCT CONTRACT | recepient = ' + addr
      break
    case OPER.NOP:
      return
    default:
      App.alertAndHalt('Unknown operation type = ' + parseInt(type, 10))
  }

  if (!pending) {
    item.find('.buffer-content').css('color', 'grey')
    item.find('.confirm-oper-otp').text('')
    item.find('.oper-already-executed').show()
    item.find('.buffer-item-confirm-stuff').hide()
    item.find('.buffer-otpid-wrapper').css('color', 'grey')
  } else {
    // operations is pending
    item.find('.buffer-item-confirm-stuff').show()
    item.find('.oper-already-executed').hide()

    // dim invalidated operation
    let offsetFirstOper = 1
    var hashLevelOfTop = Math.floor(((topIndOfOperations - offsetFirstOper) % mtAdapter.auth.MT_child_numberOfOTPs) / mtAdapter.auth.MT_child_numberOfLeafs)
    var hashLevelOfOper = Math.floor(i / mtAdapter.auth.MT_child_numberOfLeafs)
    console.log(`hashLevelOfTop = ${hashLevelOfTop} and hashLevelOfOper = ${hashLevelOfOper}`)
    if (hashLevelOfOper < hashLevelOfTop) {
      item.find('.is-invalidated').show()
      item.find('.confirm-oper-btn').attr('disabled', true)
      item.find('.confirm-oper-otp').attr('disabled', true)
      item.css('color', 'grey')
    } else {
      item.find('.is-invalidated').hide()
      item.find('.confirm-oper-btn').attr('disabled', false)
      // item.find(".confirm-oper-btn").show();
      item.css('color', 'black')
    }
  }
  item.find('.buffer-otpid-wrapper').show()
  item.find('.buffer-otpid').text(userDisplayedOtpId)
  item.find('.buffer-otpid').attr('title', otpID)
  item.find('.buffer-content').text(toAppend)

  // all child tree OTPs were depleted
  if (i === mtAdapter.auth.MT_child_numberOfOTPs - 2 && i + mtAdapter.getOffsetOfCurrentSubtree() !== mtAdapter.auth.MT_parent_numberOfOTPs - 2) {
    if ('red' != $('#buffer-of-operations').css('border-color')) {
      $('#label-buffer-isfull').show()
      $('#new-subtree-area').show()
      $('#buffer-of-operations').css('border-color', 'red')
      $('#init-oper').hide()

      // update displayed OTP ID for next child tree form
      $('#new-subtree-otp-id').text(i + mtAdapter.getOffsetOfCurrentSubtree() + 2)
    }
  } else if (i + mtAdapter.getOffsetOfCurrentSubtree() === mtAdapter.auth.MT_parent_numberOfOTPs - 2) {
    // all parent tree OTPs were depleted
    $('#buffer-of-operations').css('border-color', 'red')
    $('#label-buffer-isfull').show()
    $('#init-oper').hide()
    $('#new-subtree-area').hide()
    $('#new-parent-tree-area').show()
    $('#new-parent-otpid-displayed').text(mtAdapter.auth.MT_parent_numberOfOTPs)
  }
}

function noDepletedChildOTPs () {
  $('#buffer-of-operations').css('border-color', 'black')
  $('#new-subtree-otp').val('')
  $('#new-subtree-area').hide()
  $('#label-buffer-isfull').hide()
}

function noDepletedParentOTPs () {
  noDepletedChildOTPs()
  $('#new-parent-otp').val('')
  $('#new-parent-auth-seed').val('')
  $('#new-parent-tree-area').hide()
}

function updatePageAfterDeploy (MT_rootHashHex, MT_parent_OTPs, owner, receiverOfLastResortFunds, maxInactiveDays, MTheight, contractAddress) {
  $('#root-hash-value').text(MT_rootHashHex)
  $('#owner').text(owner)
  $('#contract-address').text(contractAddress)
  $('#last-resort-addr').text(receiverOfLastResortFunds)
  $('#remaining-OTPs').text(MT_parent_OTPs).css('color', 'black')
  noDepletedChildOTPs()

  if (maxInactiveDays == 0n) {
    $('#last-resort-timeout').text('-')
    $('#last-resort-remaining-days').text('-')
  } else {
    $('#last-resort-timeout').text(maxInactiveDays)
    $('#last-resort-remaining-days').text(maxInactiveDays)
  }
}

function prepareAndvalidateInitOperParams () { // it should convert floats to ints that are suitable for smart contract
  var operType = $('#init-oper-type').val()
  var operParam = $('#init-oper-param').val().trim()
  var operParamRet = operParam
  var operAddress = $('#init-oper-address').val().trim()
  var typeParam = parseInt(operType)
  if ($('#label-buffer-isfull').css('display') !== 'none' ) {
    App.alertAndHalt('Child tree is full. Introduce new child tree, please.')
  }

  switch (typeParam) {
    case OPER.TRANSFER:
      console.log('Validation of TRANSFER')
      var amount = validatePositiveFloat(operParam, 'amount');
      validateBalanceAndLimits(amount)
      operParamRet = web3.utils.toWei(operParam, 'ether')
      validateAddress(operAddress, 'reciever')
      break
    case OPER.DAILY_LIMIT:
      console.log('Validation of LAST_RES_TIMEOUT | DAILY_LIMIT')
      operParamRet = web3.utils.toWei(validatePositiveFloat(operParam, 'daily limit').toString(), 'ether')
      operAddress = NULL_ADDRESS
      break;
    case OPER.LAST_RES_TIMEOUT:
      console.log('Validation of LAST_RES_TIMEOUT')
      validatePositiveInt(operParam, 'timeout')
      operAddress = NULL_ADDRESS
      break;
    case OPER.LAST_RES_ADDR:
      console.log('Validation of LAST_RES_ADDR')
      validateAddress(operAddress, 'last resort address')
      operParam = 0
      break
    case OPER.DESTRUCT:
      console.log('Validation of DESTRUCT')
      validateAddress(operAddress, 'target address')
      operParam = 0
      break
    default:
      App.alertAndHalt('No operation selected' )
  }
  $('#init-oper-param').val('');
  $('#init-oper-address').val('');
  return [operType, operParamRet, operAddress]
}

function validateMnemonicAndGetItsValue (elemenIdOfMnem, throwException = true) {
  console.log('elemenIdOfMnem = ', elemenIdOfMnem)
  var mnemStr = $(elemenIdOfMnem).val().trim()
  console.log('validateMnemonicAndGetItsValue: ', mnemStr)
  var words = ('' === mnemStr) ? [] : unorm.nfkd(mnemStr).split(' ')
  var mnemHex = null
  var errMsg = null
  try {
    mnemHex = bip39.mnemonicToEntropy(mnemStr.toLowerCase(), ENGLISH_WORDLIST)
    console.log("mnemStr's hex is: ", mnemHex)
  } catch (error) {
    if (error.message.search('Invalid mnemonic checksum') !== -1) {
      errMsg = 'Invalid checksum: Check or rewrite the mnemonic string again.'
    } else {
      var wrongWords = []
      words.forEach(word => {
        var i = ENGLISH_WORDLIST.indexOf(word.toLowerCase())
        if (i === -1) {
          wrongWords.push(word.toUpperCase())
          mnemStr = mnemStr.replace(word, word.toUpperCase())
          $(elemenIdOfMnem).val(mnemStr)
        }
      })
      console.log('wrongWords: ', wrongWords)
      if (wrongWords.length > 0) {
        errMsg = 'Invalid mnemonic: typo in the following words of mnemonic: ' + wrongWords
      } else if (words.length !== 12) {
        errMsg = 'Invalid mnemonic: the number of words must be 12, but it is ' + words.length
      }
    }
    if (throwException) {
      App.alertAndHalt(errMsg)
    } else {
      alert(errMsg)
    }
  }
  return mnemHex
}

function validateAddress (a, msg) {
  var addr = a.trim()
  // console.log("validating address : ", addr.substr(2))
  if (typeof (addr) !== 'string' || addr.substr(0, 2) != '0x' || addr.length != 42 || isNaN(parseInt(addr.substr(2), 16))) {
    App.alertAndHalt("Parameter '" + msg + "' is invalid. Correct format is 0x followed by 40 hex characters.")
  }
  return addr.toLowerCase()
}

function validatePositiveInt (v, msg = 'value') {
  var ret = parseInt(v, 10)
  console.log('validatePositiveInt = ', ret, typeof ret)
  if (isNaN(ret) || ret < 0) {
    App.alertAndHalt("Parameter '" + msg + "' must be a positive integer(" + v.toString() + 'provided)'  )
  }
  return ret
}

function validatePositiveFloat (v, msg = 'value') {
  var ret = parseFloat(v)
  console.log('validatePositiveFloat = ', ret, typeof ret)
  if (isNaN(ret) || ret < 0.0) {
    App.alertAndHalt("Parameter '" + msg + "' must be a positive float (" + v.toString() + 'provided)'  )
  }
  return ret
}

function validateNaturalNumber (v, msg = 'value') {
  var ret = validatePositiveInt(v, msg)
  if (ret === 0)
    App.alertAndHalt("Parameter '" + msg + "' must be a natural number - i..e, > 0 (" + v.toString() + 'provided)'  )
  return ret
}

function validateBalanceAndLimits (requestedAmount) {
  var limit = parseFloat($('#daily-limit-value').text())
  var toSpent = parseFloat($('#daily-limit-available-to-spent').text())
  var balance = parseFloat($('#balance').text())

  if(balance === 0 || balance < requestedAmount) {
    App.alertAndHalt('You do not have enough balance to make requested transfer.')
  }
  if (limit !== 0 && toSpent < requestedAmount) {
    App.alertAndHalt('Your remaining daily allowance is only ' + (toSpent).toString() + ' ETH, which is not enough.')
  }
}

function validateAndGetNumberOfLeaves (v) {
  var a = validatePositiveInt(v)
  if (Math.floor(Math.log2(a)) !== Math.log2(a)) {
    App.alertAndHalt('Number of leaves must be a positive integer equal to x-th power of 2.')
  }
  return a
}

Number.prototype.padLeft = function (size) {
  var s = this.toString(16)
  while (s.length < (size || 2)) {
    s = '0' + s
  }
  return s
}

function makeDirtyHackforWeb3Beta1_0_0 () {
  // dirty hack for web3@1.0.0 support for localhost testrpc, see https://github.com/trufflesuite/truffle-contract/issues/56#issuecomment-331084530
  if (typeof TruffleContractWH.currentProvider.sendAsync !== 'function') {
    TruffleContractWH.currentProvider.sendAsync = function () {
      return TruffleContractWH.currentProvider.send.apply(
        TruffleContractWH.currentProvider, arguments
      )
    };
  }
}

function concatB32 (a, b) {
  if (typeof (a) !== 'string' || typeof (b) !== 'string' || a.substr(0, 2) != '0x' || b.substr(0, 2) != '0x') {
    console.log('a, b = ', a, b)
    throw new Error('ConcatB32 supports only hex string arguments');
  }
  a = hexToBytes(a)
  b = hexToBytes(b)
  var res = []
  if (a.length != b.length || a.length != 16 || b.length != 16) {
    throw new Error('ConcatB32 supports only equally-long (16B) arguments.');
  } else {
    for (var i = 0; i < a.length; i++) {
      res.push(a[i])
    }
    for (var i = 0; i < b.length; i++) {
      res.push(b[i])
    }
  }
  return bytesToHex(res)
}

// Convert a byte array to a hex string
function bytesToHex (bytes) {
  var hex = []
  for (i = 0; i < bytes.length; i++) {
    hex.push((bytes[i] >>> 4).toString(16))
      hex.push((bytes[i] & 0xF).toString(16))
  }
  // console.log("0x" + hex.join(""));
  return '0x' + hex.join('');
}

// Convert a hex string to a byte array
function hexToBytes (hex) {
  if (hex.length < 2 || hex.substr(0, 2) != '0x' || hex.length % 2 != 0) {
    throw 'hexstrToByteArray has incorrect input'
  }
  var bytes = []
  for (let c = 2; c < hex.length; c += 2)
    bytes.push(parseInt(hex.substr(c, 2), 16))
  return bytes
}

function h (a) {
  return window.web3.utils.soliditySha3({
    v: a,
t: 'bytes',
    encoding: 'hex'
  }).substring(0, 34)
}

const increaseTime = addSeconds => {
  window.web3.currentProvider.send({
    jsonrpc: '2.0',
    method: 'evm_increaseTime',
    params: [addSeconds],
id: 0
  },
  function (error, result) {
    console.log(`error = ${error} result = `, result)
  }
  )
}

function isStorageItemDefined (item) {
  if ('null' == item || 'undefined' == item || item == null || undefined == item) {
    return false
  }else {
    return true
  }
}

function renderXml (id, xml_string) {
  var doc = new DOMParser().parseFromString(xml_string, 'application/xml')
  var el = document.getElementById(id)
  el.appendChild(
    el.ownerDocument.importNode(doc.documentElement, true)
  )
}

/// / LAUNCHING THE APP ON LOAD EVENT

window.addEventListener('load', async () => {
  await $(document).ready()
  // console.log("web3 = ", web3);
  // console.log("ethereum.isMetaMask = ", ethereum);
  if (typeof web3 !== 'undefined') { // Checking if Web3 has been injected by the browser (Mist/MetaMask)
  // if (window.ethereum.isMetaMask) { // Checking if Web3 has been injected by the browser (Mist/MetaMask)
    console.warn('Using web3 detected from external source.')
    window.web3 = new Web3(web3.currentProvider) // Use Mist/MetaMask's provider
    App.network = (window.web3.givenProvider.networkVersion == LOCAL_NET_ID) ? NETWORKS.ADVANCED : NETWORKS.ROPSTEN

  } else {
    console.warn('No web3 detected. Falling back to http://127.0.0.1:8777. More info here: http://truffleframework.com/tutorials/truffle-and-metamask')
    window.web3 = new Web3(new Web3.providers.HttpProvider('http://127.0.0.1:8777')) // fallback strategy = local node
    App.network = NETWORKS.ADVANCED
    if (AUTH_MODES.NOAUTH === CUR_AUTH_MODE) {
      $('#no-auth-info').show()
    }
    $('#btn-increase-evm-time').show()
  }
  $('#deposit-assets-area').show()
  console.log('Using network ', App.network)
  await App.refreshAccounts()
  App.start()
  // var QRC = qrcodegen.QrCode;
  // console.log(qrcodegen);
  // var qr0 = QRC.encodeBinary(hexToBytes("0xf1124de92a74638a373d07a40f0b9c28"), QRC.Ecc.LOW);
  // var svg = qr0.toSvgString(4);
  // renderXml("svg", svg);
  // console.log("0xf1124de92a74638a373d07a40f0b9c28 as bytes: ", hexToBytes("0xf1124de92a74638a373d07a40f0b9c28"));

})
