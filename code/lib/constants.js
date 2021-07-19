module.exports = {
  TokenType: {
    0: 'ERC20',
    1: 'ERC721',
    2: 'ERC1155',
    'ERC20': 0,
    'ERC721': 1,
    'ERC1155': 2,
  },
  OperationType: {
    TRACK: 0,
    UNTRACK: 1,
    TRANSFER_TOKEN: 2,
    OVERRIDE_TRACK: 3,
    0: 'TRACK',
    1: 'UNTRACK',
    2: 'TRANSFER_TOKEN',
    3: 'OVERRIDE_TRACK'
  },
  EmptyAddress: '0x0000000000000000000000000000000000000000',
  EmptyBech32Address: 'one1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqquzw7vz',
}
