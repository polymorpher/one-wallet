const path = require('path')
const CopyWebpackPlugin = require('copy-webpack-plugin')
require('@babel/polyfill')

module.exports = {
  node: {
    fs: 'empty',
    child_process: 'empty',
  },
  entry: './src/index.js',
  output: {
    filename: 'main.js',
    path: path.resolve(__dirname, 'dist')
  },
  plugins: [
    // Copy our app's index.html to the build folder.
    new CopyWebpackPlugin([
      { from: './src/index.html', to: 'index.html' },
      { from: './src/wordlists', to: './wordlist' },
      { from: './js', to: './js' },
      { from: './css', to: './css' },
      { from: './src/existing-wallets.js', to: 'existing-wallets.js' }
    ])
  ]
}
