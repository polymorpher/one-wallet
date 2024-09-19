#!/bin/bash
export NETWORK=harmony-mainnet
export RELAYER=hiddenstate
export RELAYER_SECRET=onewallet

export MIN_WALLET_VERSION=3
export PUBLIC_URL=
#  harmony 1wallet DSN
export SENTRY_DSN=https://f87ac552e9394dcbae047f9acb4d587d@o896820.ingest.sentry.io/5841414
export WEBAPP_NAME="1wallet"
export LOGO_ID="harmony"
export LOGO_LINK="https://harmony.one"
export APP_LINK="https://harmony.one/1wallet"
export FAVICON="assets/1wallet/logo.png"
export TITLE="Harmony 1wallet | By Modulo.so"

yarn debug
