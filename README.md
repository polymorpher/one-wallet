# 1wallet (ONE Wallet)

1wallet is here to make crypto make sense again. It is designed for people who want the best and the latest from the world of crypto, but are tired of managing those senseless "mnemonic words", "private keys", or "seed phrases". 

You don't need to be technical to use 1wallet. It is:

- **Simple**: to create a wallet, just scan a QR code to Google Authenticator scan
- **Secure**: authorize transactions with Google Authenticator code. No private keys or passwords to take care of.
- **Durable**: restore wallet by scanning QR code from Google Authenticator, or recover funds using another wallet.
- **Smart**: imagine a (physical) wallet that has an embedded computer - it can do a lot more than a plain old wallet that only carries your money around.   

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

## Local Setup

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

## Folders

### /code

This folder contains code for ONE Wallet (under active development), per [Wiki](https://github.com/polymorpher/one-wallet/wiki) and [Protocol](https://github.com/polymorpher/one-wallet/blob/master/wiki/protocol.pdf) specification

### /wiki

This folder contains a synchronized version of the [Wiki](https://github.com/polymorpher/one-wallet/wiki). It is created so that other contributors can create pull requests and contribute to the wiki.

### /SmartOTP

This folder contains smart contract, testing, and authenticator code from [SmartOTP](https://github.com/ivan-homoliak-sutd/SmartOTPs) by Ivan Homoliak, re-written in ES2020 and modified for running on Harmony network.

### /legacy

This folder contains legacy code that was originally forked from [an early demo](https://github.com/hashmesan/harmony-totp) written by Quoc Le, then went through multiple iterations of improvements and bug fixes, before being discontinued and preserved.

## Q & A

For questions and discussions, please move to [issues page](https://github.com/polymorpher/one-wallet/issues).

## Contribute

The Wiki pages are mirrored in `/wiki` folder.

To contribute on the wiki, please submit pull requests to `.md` files in `/wiki` folder.

If something is out-of-sync, please submit an issue.

