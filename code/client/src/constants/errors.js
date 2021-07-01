
export const AddressError = {
  Unknown: (ex) => new Error('Invalid address. Inner error: ' + ex && ex.message),
  InvalidBech32Address: (ex) => new Error('Invalid bech32 address. ' + ex && ex.message),
  InvalidHexAddress: (ex) => new Error('Invalid hex address' + ex && ex.message),
}
