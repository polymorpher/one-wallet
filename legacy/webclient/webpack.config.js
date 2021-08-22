const path = require('path')
const webpack = require('webpack')
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin
const HtmlWebpackPlugin = require('html-webpack-plugin')
// const CopyWebpackPlugin = require('copy-webpack-plugin')

module.exports = {
  devServer: {
    port: 3000,
    https: true,
    http2: true,
    historyApiFallback: true,
  },
  module: {
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
        test: /\.(scss|css)$/,
        use: ['style-loader', 'css-loader', 'sass-loader'],
      },
    ],
  },
  entry: {
    main: ['./src/index.js'],
    oneWalletWorker: ['./src/worker/oneWalletWorker.js'],
    hashBenchmark: ['./src/worker/hashBenchmark.js'],
    sha256benchmarkWorker: ['./src/worker/sha256benchmarkWorker.js'],
  },
  devtool: 'source-map',
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
    clean: true
  },
  resolve: {
    modules: [path.resolve(__dirname, 'node_modules'), 'node_modules'],
    extensions: ['.jsx', '.js'],
    alias: {
      'worker_threads': false,
      'fs': false,
    },
    fallback: {
      path: require.resolve('path-browserify'),
      os: require.resolve('os-browserify'),
      crypto: require.resolve('crypto-browserify'),
      https: require.resolve('https-browserify'),
      http: require.resolve('stream-http'),
      stream: require.resolve('stream-browserify'),

      // for skipping polyfill, in case they are buggy or affecting performance
      // path: false,
      // os: false,
      // crypto: false,
      // https: false,
      // http: false,
      // stream: false,
    }
  },
  plugins: [
    // new CopyWebpackPlugin([
    //   { from: './src/index.html', to: 'index.html' },
    // ]),
    // new webpack.DefinePlugin({
    //   'process.env.NODE_ENV': JSON.stringify('development')
    // }),
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
