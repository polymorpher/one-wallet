#!/usr/bin/env bash
cat build/contracts/ONEWallet.json| jq -r '.deployedBytecode' | wc -c
