var PreloadedWallets = Object.freeze(
  [ {
    'network_name': 'ropsten',
    'wallets': [
      // {
      //     "address": "0x18a0ad05c11e259031db6181018e9e444c1adec7",
      //     "name": "Ropsten wallet 1",
      //     "leaves" : 8,
      //     "subtree_leaves" : 2,
      //     "hash_chain_len" : 2,
      //     "parent_tree_idx" : 0,
      //     "created_at": "12/8/2018, 1:53:55 PM",
      //     "leaves_data": ["0xa83e5cc11181c5eeca2d22aafccfdfcb","0x77773344aba0eb1f9b1ef5fd1c72d842",
      //                     "0xc9a78a8ac78b67f11f79c00d43529ac1","0x765a4e5a462a6bb8c4fad73453d6be0a",
      //                     "0xcbc32cf9ff90fa33dd99b158410fae35","0x546d44d9983ac77cd5c5b3fcac4da08f",
      //                     "0xa2eed2d55dc54b2692dbee7f48855468","0xe22618a4ffad82fb1b318790e2cea8c3"],
      //     "owner" : "0x41bE05ee8D89c0Bc9cA87faC4488ad6e6A06D97E"
      // },
      // {
      //     "address": "0xafc737238d47183a3e533edf46ddd5075d060d87",
      //     "name": "Ropsten wallet 2",
      //     "leaves" : 16,
      //     "subtree_leaves" : 8,
      //     "hash_chain_len" : 4,
      //     "parent_tree_idx" : 0,
      //     "created_at": "12/8/2018, 2:10:05 PM",
      //     "leaves_data": ["0x5d51450c0fb03675b987cb084d58082d","0x36ef485126528c61054e449e94b75614","0xf05d8898ae5801939fa1c844565c9f2e",
      //                     "0x6fa5ec7874d9e2811947ad6ab99018e8","0x5c4da21b4f59d3d8191756c0836f90d4","0xb5851a96e353f6900c469ea7b783a4d7",
      //                     "0xcd027df78a3c6bb3a5b0683384fc200a","0x958830d51ce73305080a3740432b74d4","0x50aa002b1739feacdb580e529d24276c",
      //                     "0x5a8121aed4c8c4c0c74e71895bfb1287","0xf5e3f2a7232b4a8d9cdfd95526698157","0x95644d2c2c6b21f99c6ff9a2578d1b15",
      //                     "0xecc71f1de2ad2839b5243abc5eba6354","0x9a88bb9bd65423547f4337ff97b2a257","0x85ea3ba56a0676f9fbcc7173306c0c42",
      //                     "0xedc5630c08544272c0d99e0e1633cdcb"],
      //     "owner" : "0x41bE05ee8D89c0Bc9cA87faC4488ad6e6A06D97E"
      // },
      {
        'address': '0x01a243c50b9740444d6fDf238F4e1fe27787D94D',
        'name': 'Non-existing wallet',
        'leaves': 16,
        'subtree_leaves': 16,
        'hash_chain_len': 1,
        'parent_tree_idx': 0,
        'created_at': 'Aug-8-2018 01:45:42 AM +UTC',
        'leaves_data': null,
        'owner': '0x41bE05ee8D89c0Bc9cA87faC4488ad6e6A06D97E'
      }
    ]
  },
  {
    'network_name': 'test',
    'wallets': [
      {
        'address': '0xa4392264a2d8c998901d10c154c91725b1bf0158',
        'name': 'Testing wallet 1',
        'leaves': 16,
        'subtree_leaves': 16,
        'hash_chain_len': 1,
        'parent_tree_idx': 0,
        'created_at': 'Aug-8-2018 01:45:42 AM +UTC',
        'leaves_data': null,
        'owner': '0xF66813EF76e97a70Dab82f1c1D5132Ba85Abbe2e'
      }
    ]
  },
  {
    'network_name': 'advanced',
    'wallets': [
      {
        'address': '0xE38abF339d8b1e7b36697b957E76160C71a293F9',
        'name': 'Testing wallet at advanced network',
        'leaves': 8,
        'subtree_leaves': 4,
        'hash_chain_len': 1,
        'parent_tree_idx': 0,
        'created_at': 'Nov-23-2019 01:45:42 AM +UTC',
        'leaves_data': null,
        'owner': ''
      }
    ]
  }
  ])

module.exports = PreloadedWallets
