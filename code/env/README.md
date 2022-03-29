## Ganache Local Environment Setup

This tool is assuming you have `ganache-cli` (a.k.a. ganache) installed locally. If you have not, run

```
npm install -g ganache
```

Ganache CLI is more customizable and up-to-date than ganache-ui. For example, it allows custom balance, websocket support, custom contract size, call gas limit, and block parameters. By default, it runs on port 8545, which does not conflict with port 7545 from the UI version. To spawn a new instance, run

```
./ganache-new.sh
```

The local state is persisted in `db` folder.

If you want to use existing private keys from your UI version, create another file `ganache.sh` (already ignored by .gitignore) and set MNEMONIC keys by using the following content in the script:

```
#!/usr/bin/env bash
export MNEMONIC="<get it from the UI, or whatever you prefer to use>"
ganache -b 2 -m "${MNEMONIC}" --server.ws --database.dbPath "./db"
```

In either case, you will also need to modify your local relayer and client to use the new instance:

- in `code/relayer/.env`, add the following:

```
GANACHE_RPC=http://127.0.0.1:8545
GANACHE_WSS=ws://127.0.0.1:8545
```

- in `code/client/.env`, add the following:

```
GANACHE_RPC=http://localhost:8545
```

Please also don't forget to delete the all cached address/hash files (`rm code/relayer/cache/v<...>/*ganache`) related to ganache. Lastly, you will also need to update the deployed factory addresses in `code/client/.env`:

```
DEPLOY_FACTORY_GANACHE=<...>
DEPLOY_DEPLOYER_GANACHE=<...>
DEPLOY_CODE_HELPER_GANACHE=<...>
```

### Safari HTTPS security issue

You may encounter HTTPS security issue when you try to run the client in Safari, accessing a local RPC endpoint (http://localhost:8545) provided by ganache.

When you encounter this issue, you will see a blank screen in "Create Wallet" screen, whereas usually a QR code would show up. This is because the client cannot call the RPC (blocked by Safari) to acquire smart-contract bytecodes for the wallet, which is needed to generate the QR code. 

There are two solutions to this issue

#### Method 1: Use websocket RPC endpoints

Simply use `GANACHE_RPC=ws://localhost:8545` in `client/.env`. This is experimental, so some other weird issues may occur.

#### Method 2: Use ngrok a proxy with domain name with ngrok-provided HTTPS

You can use ngrok to setup a proxy server under some ngrok-provided (or custom) domain name, and let ngrok provide HTTPS certificates. To do that, create `ngrok.sh`:

```
#!/usr/bin/env bash
ngrok http 8545 --hostname=<whatever-domain-name-you-have-on-ngrok>
```

Then you can setup GANACHE_RPC in `client/.env`

```
GANACHE_RPC=<whatever-domain-name-you-have-on-ngrok>
```