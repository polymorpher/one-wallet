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
  return { presets };
};
