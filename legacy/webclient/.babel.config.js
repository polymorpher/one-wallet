module.exports = () => {
  const presets = [
    [
      "@babel/env",
      {
        useBuiltIns: "usage",
        corejs: 3
      }
    ]
  ];
  const plugins = ['@babel/plugin-syntax-jsx']
  return { presets, plugins };
};