#!/usr/bin/env bash
solc @openzeppelin/=$(pwd)/node_modules/@openzeppelin/ @ensdomains/=$(pwd)/node_modules/@ensdomains/ --optimize contracts/ONEWallet.sol
