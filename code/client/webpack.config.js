// eslint-disable-next-line import/no-extraneous-dependencies
const path = require('path')
const webpack = require('webpack')
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin
const HtmlWebpackPlugin = require('html-webpack-plugin')
// const CopyWebpackPlugin = require('copy-webpack-plugin')

module.exports = {
  devServer: {
    port: 3000,
    historyApiFallback: true,
  },
  module: {
    noParse: /\.wasm$/,
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              ['@babel/preset-env',
                {
                  useBuiltIns: 'usage',
                  corejs: 3,
                  modules: 'cjs'
                }],
              '@babel/preset-react',
            ]
          }
        }
      },
      {
        test: /\.(png|svg|jpg|gif)$/,
        use: [
          'file-loader',
        ],
      },
      {
        test: /\.(scss|css)$/,
        use: ['style-loader', 'css-loader', 'sass-loader'],
      },
      {
        test: /\.less$/,
        use: [
          {
            loader: 'style-loader',
          }, {
            loader: 'css-loader', // translates CSS into CommonJS
          }, {
            loader: 'less-loader',
            options: {
              lessOptions: {
                javascriptEnabled: true,
              }
            }
          }
        ]
      },
      {
        test: /\.wasm$/,
        loader: 'base64-loader',
        type: 'javascript/auto',
      },
    ],
  },
  entry: {
    main: ['./src/index.js'],
    ONEWalletWorker: ['./src/worker/ONEWalletWorker.js']
  },
  devtool: process.env.DEBUG && 'source-map',
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
    publicPath: '/'
  },

  externals: {
    path: 'path',
    fs: 'fs',
  },
  resolve: {
    modules: [path.resolve(__dirname, 'node_modules'), 'node_modules'],
    extensions: ['.jsx', '.js'],
    fallback: {
      stream: require.resolve('stream-browserify'),
      // TODO: remove later, after web3 is removed from dependency (for ethereum compatibility)
      http: require.resolve('stream-http'),
      fs: false,
      os: require.resolve('os-browserify/browser'),
      https: require.resolve('https-browserify'),
      crypto: require.resolve('crypto-browserify')
    }
  },
  plugins: [
    new webpack.EnvironmentPlugin({
      PUBLIC_URL: '',
      NETWORK: '',
      RELAYER: '',
      RELAYER_SECRET: 'onewallet',
      DEBUG: false,
      MIN_WALLET_VERSION: 0,
      SENTRY_DSN: '', // dev
    }),
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
    }),
    new HtmlWebpackPlugin({
      inject: true,
      filename: 'index.html',
      template: 'assets/index.html',
      environment: process.env.NODE_ENV,
      hash: true
    }),
    new webpack.ProvidePlugin({
      process: 'process/browser',
    }),
    process.env.SIZE_ANALYSIS ? new BundleAnalyzerPlugin({ }) : null
  ].filter(i => i)
}
