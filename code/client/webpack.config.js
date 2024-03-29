// eslint-disable-next-line import/no-extraneous-dependencies
const path = require('path')
const webpack = require('webpack')
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin
const HtmlWebpackPlugin = require('html-webpack-plugin')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const Dotenv = require('dotenv-webpack')
const Polyfill = require('node-polyfill-webpack-plugin')
const fs = require('fs')

const splashScreenContent = fs.readFileSync(process.env.SPLASH || './assets/modulo/splash.html', { encoding: 'utf-8' })

module.exports = {
  devServer: {
    port: 3000,
    server: 'https',
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
        test: /\.svg$/i,
        type: 'asset',
        resourceQuery: { not: [/el/] }, // exclude react component if *.svg?el
      },
      {
        test: /\.svg$/i,
        resourceQuery: /el/, // *.svg?el
        use: ['@svgr/webpack'],
      },
      {
        test: /\.(png|jpg|gif)$/,
        type: 'asset/resource'
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
    publicPath: '/',
    hashFunction: 'sha256',
  },
  externals: {
    path: 'path',
    fs: 'fs',
  },
  resolve: {
    modules: [path.resolve(__dirname, 'node_modules'), 'node_modules'],
    extensions: ['.jsx', '.js'],
    fallback: {
      // stream: require.resolve('stream-browserify'),
      // TODO: remove later, after web3 is removed from dependency (for ethereum compatibility)
      // http: require.resolve('stream-http'),
      // fs: false,
      // os: require.resolve('os-browserify/browser'),
      // https: require.resolve('https-browserify'),
      // crypto: require.resolve('crypto-browserify')
    }
  },
  node: {
    global: true,
    __filename: false,
    __dirname: true,
  },
  plugins: [
    new Dotenv(),
    new Polyfill(),
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
      LOGO_ID: '',
      LOGO_LINK: '',
      APP_LINK: '',
      WEBAPP_NAME: '',
    }),
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
    }),
    new CopyWebpackPlugin({
      patterns: [
        { from: 'assets/flags', to: 'flags' },
        { from: 'assets/1wallet', to: '1wallet' },
        { from: 'assets/modulo', to: 'modulo' }
      ],
      options: { concurrency: 50 },
    }),
    new HtmlWebpackPlugin({
      templateParameters: {
        manifestFile: process.env.MANIFEST ?? 'modulo/app.webmanifest',
        splashScreenContent,
        appIcon: process.env.APP_ICON ?? 'modulo/icons/apple-icon-180.png',
      },
      inject: true,
      filename: 'index.html',
      template: 'assets/index.html',
      favicon: process.env.FAVICON ?? 'assets/modulo/logo.png',
      title: process.env.TITLE ?? 'Dev: OTP Wallet | By Modulo.so',
      environment: process.env.NODE_ENV,
      hash: true,
      minify: { conservativeCollapse: true }
    }),

    new webpack.ProvidePlugin({
      process: 'process/browser',
    }),
    process.env.SIZE_ANALYSIS ? new BundleAnalyzerPlugin({ }) : null
  ].filter(i => i)
}
