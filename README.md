# 1wallet (ONE Wallet)

1wallet is designed for people who want the best and the latest from the world of crypto, but do not want to deal with senseless "mnemonic words", "private keys", or "seed phrases". 

You don't need to be technical to use 1wallet. It is:

- **Simple**: to create a wallet, just scan a QR code using the Google Authenticator app
- **Secure**: authorize transactions with 6-digit code from Google Authenticator. No private keys or passwords to take care of.
- **Durable**: easily restore wallet by scanning QR code exported by Google Authenticator, or recover funds using another wallet.
- **Smart**: configurable spending limit, composable security, and auto-recover mechanisms. Imagine a (physical) wallet that has an embedded computer - it can do a lot more than a plain old wallet that only carries your money around.   

Try it at https://1wallet.crazy.one

## Technical Blurb

1wallet is an unconventional keyless, non-custodial smart contract wallet. 

As a smart contract wallet, it can do many things a traditional wallet couldn't do: setting up daily spending and transfer limit, recover funds using another address, automatically track tokens (ERC/HRC-20, 721, 1155), automatically interact with other smart contracts, and a lot more. 

As a keyless wallet, 1wallet is protected by dynamically generated one-time-password from Google Authenticator every 30 seconds. No private key or password is stored at the client. This removes the biggest vulnerability for hacking and theft: you cannot lose private keys if you don't have it! It also removes the hassle of managing them and being forced to remember or write down a bunch of random recovery phrases.

Since Google Authenticator operates offline and is well insulated<sup>1</sup> on your phone, it is much more secure than a private key wallet which usually stores a password protected private key on your hard drive in a file easy-to-access location, such as MetaMask - once your wallet file is copied and your password is leaked, your money is gone.

1wallet is non-custodial. Only you, who controls the Google Authenticator that scanned the setup QR code, can access and control the wallet. The wallet's operations do not rely on any centralized server operated by any company.

1wallet is EVM compatible. It currently operates exclusively on [Harmony network](https://harmony.one).

[1]: Unless you use rooted or jailbreak devices, in which case you need to take care of security insulation by yourself

## Design and Technical Specification

Please visit the Wiki page: https://github.com/polymorpher/one-wallet/wiki

## Quick Start

We assume you are on macOS or Linux. Windows is not supported as a development environment at this time. 

First, you need to install all essential dependencies and apply a patch to one of the dependencies. To do this, simply run the following at the root directory of this project:

```
./scripts/setup.sh
```

Next, try starting a local web client:

```
cd code/client
yarn run dev
```

Follow the link from terminal (https://localhost:3000), you should now see 1wallet client in your browser, hosted locally.  

For more advanced setup, such as using a locally hosted relayer (`/code/relayer`), the command line interface (`/code/cli`), and debugging the smart contract via Truffle (`/code`), please refer to README file in the corresponding folders:

- Relayer: https://github.com/polymorpher/one-wallet/tree/master/code/relayer
- CLI: https://github.com/polymorpher/one-wallet/tree/master/code/cli
- Truffle: https://github.com/polymorpher/one-wallet/tree/master/code
- Smart Contract: https://github.com/polymorpher/one-wallet/tree/master/code/contracts

## Directory Structure

- [`/code`](https://github.com/polymorpher/one-wallet/tree/master/code): Primary code base. Contains all code related to 1wallet.
- [`/wiki`](https://github.com/polymorpher/one-wallet/tree/master/wiki): Mirroring [Wiki](https://github.com/polymorpher/one-wallet/wiki) and [Protocol](https://github.com/polymorpher/one-wallet/blob/master/wiki/protocol.pdf), so people can contribute and make pull requests. 
- [`/smartotp`](https://github.com/polymorpher/one-wallet/tree/master/smartotp): Early research code from [SmartOTP](https://github.com/ivan-homoliak-sutd/SmartOTPs), created by Ivan Homoliak, mildly refactored by @polymorpher in ES2020 for debugging and running on Harmony network. Smart contract, testing, and authenticator code only.
- [`/legacy`](https://github.com/polymorpher/one-wallet/tree/master/legacy): legacy code forked from [an early TOTP demo](https://github.com/hashmesan/harmony-totp/tree/dd966f8ca74f084c38ed5a1aca10760e3e90eaf7) by Quoc Le, refactored and rebuilt by @polymorpher for testing and benchmarking, and discontinued in June 2021.

## Discussions

Please visit our [issues page](https://github.com/polymorpher/one-wallet/issues).

## License

See https://github.com/polymorpher/one-wallet/blob/master/LICENSE. The license shall be governed by and construed in accordance with the laws of the State of California, United States of America. I accept services of processes by [email](mailto:legal@hiddenstate.xyz) and Telegram chats [@aaronqli](https://t.me/aaronqli).
