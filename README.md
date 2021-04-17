# Harmony TOTP Smart Contract 

## Webclient

Check out demo at [https://hashmesan.github.io/harmony-totp/demo.html](https://hashmesan.github.io/harmony-totp/demo.html). 
Compatible with Ethereum networks & Harmony on Metamask.

## Build smart contract

```
yarn
truffle build
```

## Setup WebClient

```
yarn (at the base level)
cd webclient
yarn
yarn dev
```

Visit http://localhost:8082


## TODO 

- [ ] Change duration/depth does the work in webworker, and show progress wheel.
- [ ] Update TOTP code show some progress / background since takes a while.
- [ ] Investigate into IndexDB for larger storage. Current implementation will break at large depth with hashes greater than 5MB or 10MB depending on browser.
- [ ] 2 TOTP code hashed together to generate stronger hashes.
- [ ] Drain account function after all codes are expired.
- [ ] Environment selector or indicator ?

## References

