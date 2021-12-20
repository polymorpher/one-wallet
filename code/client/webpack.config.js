// eslint-disable-next-line import/no-extraneous-dependencies
const path = require('path')
const webpack = require('webpack')
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin
const HtmlWebpackPlugin = require('html-webpack-plugin')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const Dotenv = require('dotenv-webpack')

module.exports = {
  devServer: {
    port: 3000,
    https: true,
    http2: true,
    historyApiFallback: true,
    hot: false,
    client: {
      overlay: false,
      progress: true,
    },
  },
  cache: {
    type: 'filesystem',
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
    new Dotenv(),
    new webpack.EnvironmentPlugin({
      PUBLIC_URL: '',
      NETWORK: '',
      RELAYER: '',
      RELAYER_SECRET: 'onewallet',
      DEBUG: false,
      MIN_WALLET_VERSION: 0,
      SENTRY_DSN: '', // dev
      LOCAL_RELAYER_URL: '',
      ROOT_URL: '',
      DEPLOY_FACTORY_GANACHE: '',
      DEPLOY_DEPLOYER_GANACHE: '',
      DEPLOY_CODE_HELPER_GANACHE: '',
    }),
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
    }),
    new HtmlWebpackPlugin({
      inject: true,
      filename: 'index.html',
      template: 'assets/index.html',
      favicon: 'assets/1wallet.png',
      environment: process.env.NODE_ENV,
      hash: true
    }),
    new CopyWebpackPlugin({
      patterns: [
        { from: 'assets/flags', to: 'flags' }
      ],
      options: { concurrency: 50 },
    }),
    new webpack.ProvidePlugin({
      process: 'process/browser',
    }),
    process.env.SIZE_ANALYSIS ? new BundleAnalyzerPlugin({ }) : null
  ].filter(i => i)
}
