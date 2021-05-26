const CopyWebpackPlugin = require('copy-webpack-plugin')
const path = require('path')
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin
module.exports = {
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
                  corejs: 3
                }],
              '@babel/preset-react',
            ]
          }
        }
      }
    ],
  },
  entry: {
    main: ['./src/index.jsx'],
    worker: ['./src/worker/generate.js'],
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist')
  },
  resolve: {
    extensions: ['.jsx', '.js'],
    fallback: {
      path: require.resolve('path-browserify'),
      os: require.resolve('os-browserify'),
      crypto: require.resolve('crypto-browserify'),
      https: require.resolve('https-browserify'),
      http: require.resolve('stream-http'),
      stream: require.resolve('stream-browserify'),

      // path: false,
      // os: false,
      // crypto: false,
      // https: false,
      // http: false,
      // stream: false,
    }
  },
  plugins: [
    // Copy our app's index.html to the build folder.
    new CopyWebpackPlugin([
      { from: './src/index.html', to: 'index.html' },
    ]),
    process.env.SKIP_ANALYSIS ? undefined : new BundleAnalyzerPlugin({ })
  ]
}
