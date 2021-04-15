const WalletHandle = artifacts.require('WalletHandle')
let AuthenticatorMT = require('../lib/authenticator')

let ac = require('../lib/auth_config.js') // Config of unit test authenticator
let auth = new AuthenticatorMT(ac.PARENT_NUMBER_OF_LEAFS, ac.CHILD_NUMBER_OF_LEAFS, ac.CHILD_DEPTH_OF_CACHED_LAYER, ac.HASH_CHAIN_LEN, ac.MNEM_WORDS, 0, null, true)
auth.dumpAllOTPs()
auth.dumpAllChildRootHashes()

let dailyLimit = 0 // no limit
let maxInactiveDays = 0 // no last resort timeout

module.exports = function (deployer, network, accounts) {
  let owner, receiverOfLastResortFunds

  if (network === 'mainnet') {
    throw new Error('Not ready for mainnet deployment yet.')
  } else if (network === 'testnet') {
    owner = '0x41bE05ee8D89c0Bc9cA87faC4488ad6e6A06D97E'
    receiverOfLastResortFunds = '0xE5987aD5605b456C1247180C4034587a94Da6A1D'
  } else { // local
    owner = accounts[0]
    receiverOfLastResortFunds = accounts[1]
  }

  console.log('Deploying WalletHandle to network', network, 'from', owner)
  console.log('\t --height of parent MT is ', auth.MT_parent_height,
    ';\n\t --height of child MT is ', auth.MT_child_height,
    ';\n\t --length of hash chain is ', auth._hashchain_len,
    ';\n\t --daily limit is ', dailyLimit,
    ';\n\t --the parent root hash is ', auth.MT_parent_rootHash,
    ';\n\t --the first child root hash is ', auth._MT_parent_layerOfChildRootHashes[0],
    ';\n\t --the number of parent leafs is ', auth._MT_parent_numberOfLeafs,
    ';\n\t --the number of child leafs is ', auth._MT_child_numberOfLeafs,
    ';\n\t --the number of parent OTPs is ', auth._MT_parent_numberOfOTPs,
    ';\n\t --the number of child OTPs is ', auth._MT_child_numberOfOTPs,
    ';\n\t --last resort address is ', receiverOfLastResortFunds,
    ';\n\t --depth of child cached layer is ', auth.MT_child_depthOfCachedLayer,
    ';\n\t --cached layer of child MT is:\n', auth.getChildCachedLayer(0)
  )

  // constructor(uint8 child_heightOfMT, uint8 child_depthOfCachedLayer, bytes16[] child_cachedLayerOfMT, bytes16 child_rootHash,
  //     bytes16 parent_rootHash, uint8 parent_height, bytes16[] confirmMaterial, bytes16 sides, // cm enables to verify integrity of child root hash
  //     uint64 _dailyLimit, address _lastResortAddr, uint64 _maxInactiveDays)

  deployer.deploy(WalletHandle, auth.MT_parent_rootHash, auth.MT_parent_height,
    auth.MT_child_height, auth.MT_child_depthOfCachedLayer, auth.getChildCachedLayer(0), ...auth.getAuthPath4ChildTree(0), auth._hashchain_len,
    dailyLimit, receiverOfLastResortFunds, maxInactiveDays, { from: owner, gas: 90 * 1000 * 1000 }
  ).then(() => {
    console.log('Deployed WalletHandle with address', WalletHandle.address)
    console.log('\t \\/== Default gas estimate:', WalletHandle.class_defaults.gas) // class_defaults
  })
}

// NOTES
//
// let W3 = require('web3');
//
// WalletHandle.deployed().then(function(instance){return instance.isCurrentMTConsistent()});
// WalletHandle.deployed().then(function(instance){return instance.isCurrentMTConsistent.call()});
// WalletHandle.deployed().then(function(instance){return instance.owner()});
// WalletHandle.deployed().then(function(instance){return instance.heightMT()}).then(function(value){return value.toNumber()});
// WalletHandle.deployed().then(function(instance){return instance.pendingTnfs()});

// Access migrated instance of contract
// WalletHandle.deployed().then(function(instance) {console.log(instance); });
//
// Get its balance
// W3.utils.fromWei(web3.eth.getBalance('0x82d50ad3c1091866e258fd0f1a7cc9674609d254').toString(), 'ether');
