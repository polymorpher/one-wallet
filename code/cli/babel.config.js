module.exports = (api) => {
  api.cache(true)
  const presets = [
    [
      '@babel/env',
      {
        useBuiltIns: 'usage',
        corejs: 3
      }
    ]
  ]
  const plugins = ['@babel/plugin-syntax-jsx', '@babel/plugin-transform-react-jsx', '@babel/plugin-transform-react-display-name']
  return { presets, plugins }
}
