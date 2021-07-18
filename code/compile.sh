#!/usr/bin/env bash
solc @openzeppelin/=$(pwd)/node_modules/@openzeppelin/ --optimize contracts/ONEWallet.sol
