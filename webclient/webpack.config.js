const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
require("@babel/polyfill");

module.exports = {
    node: {
        fs: 'empty',
        child_process: 'empty',
    },
    module: {
        rules: [
          {
            test: /\.(js|jsx)$/,
            exclude: /node_modules/,
            use: ['babel-loader'],
          },
          {
            test: /\.tsx?$/,
            use: 'ts-loader',
            exclude: /node_modules/,
          },
        ],
      },
    entry: ['@babel/polyfill', './src/index.js'],
    output: {
        filename: 'main.js',
        path: path.resolve(__dirname, 'dist')
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js'],
    },
    plugins: [
        // Copy our app's index.html to the build folder.
        new CopyWebpackPlugin([
            { from: './src/index.html', to: "index.html" },
            { from: './js', to: "./js" },
            { from: './css', to: "./css" },
        ])
    ]
};
