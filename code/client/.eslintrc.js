// eslint-disable-next-line no-undef
module.exports = {
  root: true,
  env: {
    es2020: true,
    browser: true,
    jest: true,
  },
  extends: [
    'plugin:react/recommended',
    'plugin:jsx-a11y/recommended',
    'standard-jsx',
    'standard',
  ],
  globals: {
    artifacts: 'readonly',
    contract: 'readonly',
    assert: 'readonly',
    web3: 'readonly'
  },
  // 'parser': '@babel/eslint-parser',
  rules: {
    'no-await-in-loop': 0,
    'no-underscore-dangle': 0,
    'import/prefer-default-export': 0,
    'import/no-extraneous-dependencies': 1,
    'comma-dangle': 0,
    'no-console': 0,
    'no-mixed-operators': 0,
    'max-len': 0,
    'react/prop-types': 'off',
    'jsx-a11y/label-has-associated-control': 'off',
    'react/jsx-filename-extension': [
      1,
      {
        extensions: [
          '.js',
          '.jsx'
        ]
      }
    ]
  },
  parserOptions: {
    ecmaFeatures: {
      jsx: true
    },
    requireConfigFile: false,
    ecmaVersion: 2020
  },
  plugins: [
    'jsx-a11y',
    '@babel',
    'react',
    'react-hooks'
  ],
  settings: {
    'import/resolver': 'webpack',
    react: {
      version: 'latest'
    }
  },
}
