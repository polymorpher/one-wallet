## Running analysis

[Install Slither](https://github.com/crytic/slither#how-to-install)
```
pip3 install slither-analyzer
```

Run Slither
```
cd code
slither .
```

## Initial Analysis March 7th, 2022
[gist is here](https://gist.github.com/johnwhitton/fd6682e7b9ff72577e2e5021d93ba143)

```
johnlaptop code (testing) $ slither .
'npx truffle compile --all' running (use --truffle-version truffle@x.x.x to use specific version)

Compiling your contracts...
===========================
> Compiling ./contracts/AbstractONEWallet.sol
> Compiling ./contracts/CommitManager.sol
> Compiling ./contracts/CoreManager.sol
> Compiling ./contracts/DomainManager.sol
> Compiling ./contracts/Enums.sol
> Compiling ./contracts/Executor.sol
> Compiling ./contracts/Factory.sol
> Compiling ./contracts/FactoryHelper.sol
> Compiling ./contracts/Forwardable.sol
> Compiling ./contracts/IONEWallet.sol
> Compiling ./contracts/ONEWallet.sol
> Compiling ./contracts/Recovery.sol
> Compiling ./contracts/Reveal.sol
> Compiling ./contracts/SignatureManager.sol
> Compiling ./contracts/SpendingManager.sol
> Compiling ./contracts/TokenManager.sol
> Compiling ./contracts/TokenTracker.sol
> Compiling ./contracts/Version.sol
> Compiling ./contracts/WalletGraph.sol
> Compiling ./contracts/debug/Registrar.sol
> Compiling ./contracts/debug/TestTokens.sol
> Compiling @ensdomains/subdomain-registrar-core/contracts/Resolver.sol
> Compiling @ensdomains/subdomain-registrar-core/contracts/interfaces/ENS.sol
> Compiling @ensdomains/subdomain-registrar-core/contracts/interfaces/IDefaultReverseResolver.sol
> Compiling @ensdomains/subdomain-registrar-core/contracts/interfaces/IRegistrar.sol
> Compiling @ensdomains/subdomain-registrar-core/contracts/interfaces/IReverseRegistrar.sol
> Compiling @openzeppelin/contracts/token/ERC1155/ERC1155.sol
> Compiling @openzeppelin/contracts/token/ERC1155/IERC1155.sol
> Compiling @openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol
> Compiling @openzeppelin/contracts/token/ERC1155/extensions/IERC1155MetadataURI.sol
> Compiling @openzeppelin/contracts/token/ERC20/ERC20.sol
> Compiling @openzeppelin/contracts/token/ERC20/IERC20.sol
> Compiling @openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol
> Compiling @openzeppelin/contracts/token/ERC721/ERC721.sol
> Compiling @openzeppelin/contracts/token/ERC721/IERC721.sol
> Compiling @openzeppelin/contracts/token/ERC721/IERC721Receiver.sol
> Compiling @openzeppelin/contracts/token/ERC721/extensions/IERC721Metadata.sol
> Compiling @openzeppelin/contracts/utils/Address.sol
> Compiling @openzeppelin/contracts/utils/Context.sol
> Compiling @openzeppelin/contracts/utils/Strings.sol
> Compiling @openzeppelin/contracts/utils/introspection/ERC165.sol
> Compiling @openzeppelin/contracts/utils/introspection/IERC165.sol
> Compilation warnings encountered:

    Warning: Return value of low-level calls not used.
   --> project:/contracts/debug/TestTokens.sol:116:13:
    |
116 |             msg.sender.call{value : excess}("");
    |             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

,Warning: Function state mutability can be restricted to pure
  --> project:/contracts/debug/Registrar.sol:53:5:
   |
53 |     function ens() override external view returns (address){
   |     ^ (Relevant source part starts here and spans across multiple lines).


> Artifacts written to /Users/john/one-wallet/one-wallet/code/build/contracts
> Compiled successfully using:
   - solc: 0.8.4+commit.c7e474f2.Emscripten.clang



DomainManager.buyDomain(IRegistrar,IReverseRegistrar,address,uint256,string,bytes32,string) (DomainManager.sol#40-58) sends eth to arbitrary user
	Dangerous calls:
	- (success,ret) = address(reg).call{value: maxPrice}(abi.encodeWithSignature(register(bytes32,string,address,uint256,string,address),node,subdomain,address(this),MIN_DOMAIN_RENT_DURATION,,resolver)) (DomainManager.sol#42)
DomainManager.renewDomain(IRegistrar,bytes32,string,uint256) (DomainManager.sol#80-90) sends eth to arbitrary user
	Dangerous calls:
	- (success,ret) = address(reg).call{value: maxPrice}(abi.encodeWithSignature(renew(bytes32,string,uint256),node,subdomain,MIN_DOMAIN_RENT_DURATION)) (DomainManager.sol#81)
ONEWallet._drain() (ONEWallet.sol#219-227) sends eth to arbitrary user
	Dangerous calls:
	- (success) = recoveryAddress.call{value: address(this).balance}() (ONEWallet.sol#221)
ONEWallet._transfer(address,uint256) (ONEWallet.sol#229-244) sends eth to arbitrary user
	Dangerous calls:
	- (success,ret) = dest.call{value: amount}() (ONEWallet.sol#235)
ONEWallet._callContract(address,uint256,bytes) (ONEWallet.sol#324-338) sends eth to arbitrary user
	Dangerous calls:
	- (success,ret) = contractAddress.call{value: amount}(encodedWithSignature) (ONEWallet.sol#331)
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#functions-that-send-ether-to-arbitrary-destinations

Reentrancy in ONEWallet._callContract(address,uint256,bytes) (ONEWallet.sol#324-338):
	External calls:
	- (success,ret) = contractAddress.call{value: amount}(encodedWithSignature) (ONEWallet.sol#331)
	State variables written after the call(s):
	- spendingState.spentAmount -= amount (ONEWallet.sol#335)
Reentrancy in ONEWallet._transfer(address,uint256) (ONEWallet.sol#229-244):
	External calls:
	- (success,ret) = dest.call{value: amount}() (ONEWallet.sol#235)
	State variables written after the call(s):
	- spendingState.spentAmount -= amount (ONEWallet.sol#238)
Reentrancy in ONEWallet.receive() (ONEWallet.sol#86-123):
	External calls:
	- _forward(recoveryAddress) (ONEWallet.sol#95)
		- (success) = recoveryAddress.call{value: address(this).balance}() (ONEWallet.sol#221)
		- IERC20(contractAddress).transfer(dest,amount) (TokenTracker.sol#120-131)
		- tokenTrackerState.recoverAllTokens(recoveryAddress) (ONEWallet.sol#224)
		- backlinkAddresses[i].reveal(IONEWallet.AuthParams(new bytes32[](0),0,bytes32(0)),IONEWallet.OperationParams(Enums.OperationType.FORWARD,Enums.TokenType.NONE,address(0),0,dest,0,bytes())) (WalletGraph.sol#105-111)
		- (success,ret) = dest.call{value: amount}() (ONEWallet.sol#235)
		- tokenTrackerState.recoverAllTokens(dest) (ONEWallet.sol#213)
		- IERC721(contractAddress).safeTransferFrom(address(this),dest,tokenId,data) (TokenTracker.sol#133-139)
		- backlinkAddresses.batchUpdateForwardAddress(dest) (ONEWallet.sol#215)
		- IERC1155(contractAddress).safeTransferFrom(address(this),dest,tokenId,amount,data) (TokenTracker.sol#141-147)
	- _recover() (ONEWallet.sol#96)
		- (success) = recoveryAddress.call{value: address(this).balance}() (ONEWallet.sol#221)
		- IERC20(contractAddress).transfer(dest,amount) (TokenTracker.sol#120-131)
		- tokenTrackerState.recoverAllTokens(recoveryAddress) (ONEWallet.sol#224)
		- IERC721(contractAddress).safeTransferFrom(address(this),dest,tokenId,data) (TokenTracker.sol#133-139)
		- IERC1155(contractAddress).safeTransferFrom(address(this),dest,tokenId,amount,data) (TokenTracker.sol#141-147)
	External calls sending eth:
	- _forward(recoveryAddress) (ONEWallet.sol#95)
		- (success) = recoveryAddress.call{value: address(this).balance}() (ONEWallet.sol#221)
		- (success,ret) = dest.call{value: amount}() (ONEWallet.sol#235)
	- _recover() (ONEWallet.sol#96)
		- (success) = recoveryAddress.call{value: address(this).balance}() (ONEWallet.sol#221)
	State variables written after the call(s):
	- _recover() (ONEWallet.sol#96)
		- forwardAddress = recoveryAddress (ONEWallet.sol#223)
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#reentrancy-vulnerabilities

TokenTracker.transferToken(TokenTracker.TokenTrackerState,Enums.TokenType,address,uint256,address,uint256,bytes) (TokenTracker.sol#118-149) ignores return value by IERC20(contractAddress).transfer(dest,amount) (TokenTracker.sol#120-131)
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#unchecked-transfer

Contract locking ether found:
	Contract Registrar (debug/Registrar.sol#9-56) has payable functions:
	 - IRegistrar.register(bytes32,string,address,address,address) (@ensdomains/subdomain-registrar-core/contracts/interfaces/IRegistrar.sol#14)
	 - IRegistrar.payRent(bytes32,string) (@ensdomains/subdomain-registrar-core/contracts/interfaces/IRegistrar.sol#18)
	 - IRegistrar.register(bytes32,string,address,uint256,string,address) (@ensdomains/subdomain-registrar-core/contracts/interfaces/IRegistrar.sol#26)
	 - IRegistrar.renew(bytes32,string,uint256) (@ensdomains/subdomain-registrar-core/contracts/interfaces/IRegistrar.sol#34)
	 - Registrar.register(bytes32,string,address,address,address) (debug/Registrar.sol#14-16)
	 - Registrar.payRent(bytes32,string) (debug/Registrar.sol#22-24)
	 - Registrar.register(bytes32,string,address,uint256,string,address) (debug/Registrar.sol#36-38)
	 - Registrar.renew(bytes32,string,uint256) (debug/Registrar.sol#49-51)
	But does not have a function to withdraw the ether
Contract locking ether found:
	Contract ONEWalletFactory (Factory.sol#5-32) has payable functions:
	 - ONEWalletFactory.deploy(uint256,bytes) (Factory.sol#22-31)
	But does not have a function to withdraw the ether
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#contracts-that-lock-ether

TestERC1155.payToMint(uint256,uint256,address,string) (debug/TestTokens.sol#112-120) ignores return value by msg.sender.call{value: excess}() (debug/TestTokens.sol#116)
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#unchecked-low-level-calls

WalletGraph.batchUpdateForwardAddress(IONEWallet[],address).reason (WalletGraph.sol#107) is a local variable never initialized
DomainManager.reclaimReverseDomain(address,string).revNodeHash (DomainManager.sol#61) is a local variable never initialized
TokenTracker.transferToken(TokenTracker.TokenTrackerState,Enums.TokenType,address,uint256,address,uint256,bytes).reason_scope_1 (TokenTracker.sol#143) is a local variable never initialized
ERC1155._doSafeTransferAcceptanceCheck(address,address,address,uint256,uint256,bytes).response (@openzeppelin/contracts/token/ERC1155/ERC1155.sol#410) is a local variable never initialized
Executor._transferDomain(IRegistrar,address,bytes32,address).reason (Executor.sol#69) is a local variable never initialized
DomainManager.buyDomain(IRegistrar,IReverseRegistrar,address,uint256,string,bytes32,string).revNodeHash (DomainManager.sol#50) is a local variable never initialized
TokenTracker.getBalance(Enums.TokenType,address,uint256).balance_scope_1 (TokenTracker.sol#175) is a local variable never initialized
TokenTracker.getBalance(Enums.TokenType,address,uint256).reason_scope_0 (TokenTracker.sol#169) is a local variable never initialized
ERC1155._doSafeBatchTransferAcceptanceCheck(address,address,address,uint256[],uint256[],bytes).response (@openzeppelin/contracts/token/ERC1155/ERC1155.sol#432) is a local variable never initialized
DomainManager.reclaimReverseDomain(address,string).reason (DomainManager.sol#64) is a local variable never initialized
TokenTracker.getBalance(Enums.TokenType,address,uint256).reason (TokenTracker.sol#156) is a local variable never initialized
TokenTracker.transferToken(TokenTracker.TokenTrackerState,Enums.TokenType,address,uint256,address,uint256,bytes).reason_scope_0 (TokenTracker.sol#135) is a local variable never initialized
TokenTracker.getBalance(Enums.TokenType,address,uint256).balance (TokenTracker.sol#154) is a local variable never initialized
TokenTracker.getBalance(Enums.TokenType,address,uint256).reason_scope_2 (TokenTracker.sol#177) is a local variable never initialized
DomainManager.buyDomain(IRegistrar,IReverseRegistrar,address,uint256,string,bytes32,string).reason_scope_0 (DomainManager.sol#52) is a local variable never initialized
TokenTracker.transferToken(TokenTracker.TokenTrackerState,Enums.TokenType,address,uint256,address,uint256,bytes).reason (TokenTracker.sol#127) is a local variable never initialized
ERC1155._doSafeTransferAcceptanceCheck(address,address,address,uint256,uint256,bytes).reason (@openzeppelin/contracts/token/ERC1155/ERC1155.sol#414) is a local variable never initialized
ERC1155._doSafeBatchTransferAcceptanceCheck(address,address,address,uint256[],uint256[],bytes).reason (@openzeppelin/contracts/token/ERC1155/ERC1155.sol#437) is a local variable never initialized
WalletGraph.command(IONEWallet[],Enums.TokenType,address,uint256,address,uint256,bytes).reason (WalletGraph.sol#96) is a local variable never initialized
WalletGraph.reclaimDomainFromBacklink(IONEWallet[],uint32,IRegistrar,IReverseRegistrar,bytes).reason (WalletGraph.sol#79) is a local variable never initialized
TokenTracker.transferToken(TokenTracker.TokenTrackerState,Enums.TokenType,address,uint256,address,uint256,bytes).success (TokenTracker.sol#120) is a local variable never initialized
TokenTracker.getBalance(Enums.TokenType,address,uint256).owner (TokenTracker.sol#162) is a local variable never initialized
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#uninitialized-local-variables

Executor.execute(IONEWallet.OperationParams,TokenTracker.TokenTrackerState,IONEWallet[],SignatureManager.SignatureTracker,SpendingManager.SpendingState) (Executor.sol#17-64) ignores return value by DomainManager.buyDomainEncoded(op.data,op.amount,uint8(op.tokenId),op.contractAddress,op.dest) (Executor.sol#36)
Executor.execute(IONEWallet.OperationParams,TokenTracker.TokenTrackerState,IONEWallet[],SignatureManager.SignatureTracker,SpendingManager.SpendingState) (Executor.sol#17-64) ignores return value by DomainManager.renewDomain(IRegistrar(op.contractAddress),bytes32(op.tokenId),string(op.data),op.amount) (Executor.sol#40)
Executor.execute(IONEWallet.OperationParams,TokenTracker.TokenTrackerState,IONEWallet[],SignatureManager.SignatureTracker,SpendingManager.SpendingState) (Executor.sol#17-64) ignores return value by DomainManager.reclaimReverseDomain(op.contractAddress,string(op.data)) (Executor.sol#42)
TokenTracker.getBalance(Enums.TokenType,address,uint256) (TokenTracker.sol#151-184) ignores return value by IERC20(contractAddress).balanceOf(address(this)) (TokenTracker.sol#154-160)
TokenTracker.getBalance(Enums.TokenType,address,uint256) (TokenTracker.sol#151-184) ignores return value by IERC721(contractAddress).ownerOf(tokenId) (TokenTracker.sol#162-173)
TokenTracker.getBalance(Enums.TokenType,address,uint256) (TokenTracker.sol#151-184) ignores return value by IERC1155(contractAddress).balanceOf(address(this),tokenId) (TokenTracker.sol#175-181)
DomainManager.buyDomain(IRegistrar,IReverseRegistrar,address,uint256,string,bytes32,string) (DomainManager.sol#40-58) ignores return value by rev.setName(fqdn) (DomainManager.sol#50-56)
DomainManager.reclaimReverseDomain(address,string) (DomainManager.sol#60-70) ignores return value by IReverseRegistrar(rev).setName(fqdn) (DomainManager.sol#61-68)
WalletGraph.reclaimDomainFromBacklink(IONEWallet[],uint32,IRegistrar,IReverseRegistrar,bytes) (WalletGraph.sol#69-86) ignores return value by DomainManager.reclaimReverseDomain(address(rev),fqdn) (WalletGraph.sol#85)
ERC721._checkOnERC721Received(address,address,uint256,bytes) (@openzeppelin/contracts/token/ERC721/ERC721.sol#369-390) ignores return value by IERC721Receiver(to).onERC721Received(_msgSender(),from,tokenId,_data) (@openzeppelin/contracts/token/ERC721/ERC721.sol#376-386)
TokenManager.onERC1155BatchReceived(address,address,uint256[],uint256[],bytes) (TokenManager.sol#43-48) ignores return value by this.onERC1155Received(operator,from,ids[i],values[i],data) (TokenManager.sol#45)
ERC1155._doSafeTransferAcceptanceCheck(address,address,address,uint256,uint256,bytes) (@openzeppelin/contracts/token/ERC1155/ERC1155.sol#401-420) ignores return value by IERC1155Receiver(to).onERC1155Received(operator,from,id,amount,data) (@openzeppelin/contracts/token/ERC1155/ERC1155.sol#410-418)
ERC1155._doSafeBatchTransferAcceptanceCheck(address,address,address,uint256[],uint256[],bytes) (@openzeppelin/contracts/token/ERC1155/ERC1155.sol#422-443) ignores return value by IERC1155Receiver(to).onERC1155BatchReceived(operator,from,ids,amounts,data) (@openzeppelin/contracts/token/ERC1155/ERC1155.sol#431-441)
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#unused-return

DomainManager.buyDomain(IRegistrar,IReverseRegistrar,address,uint256,string,bytes32,string).resolver (DomainManager.sol#40) lacks a zero-check on :
		- (success,ret) = address(reg).call{value: maxPrice}(abi.encodeWithSignature(register(bytes32,string,address,uint256,string,address),node,subdomain,address(this),MIN_DOMAIN_RENT_DURATION,,resolver)) (DomainManager.sol#42)
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#missing-zero-address-validation

ERC1155._doSafeTransferAcceptanceCheck(address,address,address,uint256,uint256,bytes) (@openzeppelin/contracts/token/ERC1155/ERC1155.sol#401-420) has external calls inside a loop: IERC1155Receiver(to).onERC1155Received(operator,from,id,amount,data) (@openzeppelin/contracts/token/ERC1155/ERC1155.sol#410-418)
TokenTracker.getBalance(Enums.TokenType,address,uint256) (TokenTracker.sol#151-184) has external calls inside a loop: IERC20(contractAddress).balanceOf(address(this)) (TokenTracker.sol#154-160)
TokenTracker.getBalance(Enums.TokenType,address,uint256) (TokenTracker.sol#151-184) has external calls inside a loop: IERC721(contractAddress).ownerOf(tokenId) (TokenTracker.sol#162-173)
TokenTracker.getBalance(Enums.TokenType,address,uint256) (TokenTracker.sol#151-184) has external calls inside a loop: IERC1155(contractAddress).balanceOf(address(this),tokenId) (TokenTracker.sol#175-181)
TokenTracker.transferToken(TokenTracker.TokenTrackerState,Enums.TokenType,address,uint256,address,uint256,bytes) (TokenTracker.sol#118-149) has external calls inside a loop: IERC20(contractAddress).transfer(dest,amount) (TokenTracker.sol#120-131)
TokenTracker.transferToken(TokenTracker.TokenTrackerState,Enums.TokenType,address,uint256,address,uint256,bytes) (TokenTracker.sol#118-149) has external calls inside a loop: IERC721(contractAddress).safeTransferFrom(address(this),dest,tokenId,data) (TokenTracker.sol#133-139)
TokenTracker.transferToken(TokenTracker.TokenTrackerState,Enums.TokenType,address,uint256,address,uint256,bytes) (TokenTracker.sol#118-149) has external calls inside a loop: IERC1155(contractAddress).safeTransferFrom(address(this),dest,tokenId,amount,data) (TokenTracker.sol#141-147)
WalletGraph.batchUpdateForwardAddress(IONEWallet[],address) (WalletGraph.sol#103-113) has external calls inside a loop: backlinkAddresses[i].reveal(IONEWallet.AuthParams(new bytes32[](0),0,bytes32(0)),IONEWallet.OperationParams(Enums.OperationType.FORWARD,Enums.TokenType.NONE,address(0),0,dest,0,bytes())) (WalletGraph.sol#105-111)
TokenManager.onERC1155BatchReceived(address,address,uint256[],uint256[],bytes) (TokenManager.sol#43-48) has external calls inside a loop: this.onERC1155Received(operator,from,ids[i],values[i],data) (TokenManager.sol#45)
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation/#calls-inside-a-loop

Variable 'Executor._transferDomain(IRegistrar,address,bytes32,address).reason (Executor.sol#69)' in Executor._transferDomain(IRegistrar,address,bytes32,address) (Executor.sol#66-74) potentially used before declaration: DomainManager.DomainTransferFailed(reason) (Executor.sol#70)
Variable 'TokenTracker.transferToken(TokenTracker.TokenTrackerState,Enums.TokenType,address,uint256,address,uint256,bytes).success (TokenTracker.sol#120)' in TokenTracker.transferToken(TokenTracker.TokenTrackerState,Enums.TokenType,address,uint256,address,uint256,bytes) (TokenTracker.sol#118-149) potentially used before declaration: success (TokenTracker.sol#121)
Variable 'TokenTracker.transferToken(TokenTracker.TokenTrackerState,Enums.TokenType,address,uint256,address,uint256,bytes).reason (TokenTracker.sol#127)' in TokenTracker.transferToken(TokenTracker.TokenTrackerState,Enums.TokenType,address,uint256,address,uint256,bytes) (TokenTracker.sol#118-149) potentially used before declaration: TokenTransferError(tokenType,contractAddress,tokenId,dest,amount,reason) (TokenTracker.sol#128)
Variable 'TokenTracker.transferToken(TokenTracker.TokenTrackerState,Enums.TokenType,address,uint256,address,uint256,bytes).reason_scope_0 (TokenTracker.sol#135)' in TokenTracker.transferToken(TokenTracker.TokenTrackerState,Enums.TokenType,address,uint256,address,uint256,bytes) (TokenTracker.sol#118-149) potentially used before declaration: TokenTransferError(tokenType,contractAddress,tokenId,dest,amount,reason_scope_0) (TokenTracker.sol#136)
Variable 'TokenTracker.transferToken(TokenTracker.TokenTrackerState,Enums.TokenType,address,uint256,address,uint256,bytes).reason_scope_1 (TokenTracker.sol#143)' in TokenTracker.transferToken(TokenTracker.TokenTrackerState,Enums.TokenType,address,uint256,address,uint256,bytes) (TokenTracker.sol#118-149) potentially used before declaration: TokenTransferError(tokenType,contractAddress,tokenId,dest,amount,reason_scope_1) (TokenTracker.sol#144)
Variable 'TokenTracker.getBalance(Enums.TokenType,address,uint256).balance (TokenTracker.sol#154)' in TokenTracker.getBalance(Enums.TokenType,address,uint256) (TokenTracker.sol#151-184) potentially used before declaration: (balance,true,) (TokenTracker.sol#155)
Variable 'TokenTracker.getBalance(Enums.TokenType,address,uint256).reason (TokenTracker.sol#156)' in TokenTracker.getBalance(Enums.TokenType,address,uint256) (TokenTracker.sol#151-184) potentially used before declaration: (0,false,reason) (TokenTracker.sol#157)
Variable 'TokenTracker.getBalance(Enums.TokenType,address,uint256).owner (TokenTracker.sol#162)' in TokenTracker.getBalance(Enums.TokenType,address,uint256) (TokenTracker.sol#151-184) potentially used before declaration: owned = (owner == address(this)) (TokenTracker.sol#163)
Variable 'TokenTracker.getBalance(Enums.TokenType,address,uint256).reason_scope_0 (TokenTracker.sol#169)' in TokenTracker.getBalance(Enums.TokenType,address,uint256) (TokenTracker.sol#151-184) potentially used before declaration: (0,false,reason_scope_0) (TokenTracker.sol#170)
Variable 'TokenTracker.getBalance(Enums.TokenType,address,uint256).balance_scope_1 (TokenTracker.sol#175)' in TokenTracker.getBalance(Enums.TokenType,address,uint256) (TokenTracker.sol#151-184) potentially used before declaration: (balance_scope_1,true,) (TokenTracker.sol#176)
Variable 'TokenTracker.getBalance(Enums.TokenType,address,uint256).reason_scope_2 (TokenTracker.sol#177)' in TokenTracker.getBalance(Enums.TokenType,address,uint256) (TokenTracker.sol#151-184) potentially used before declaration: (0,false,reason_scope_2) (TokenTracker.sol#178)
Variable 'DomainManager.buyDomain(IRegistrar,IReverseRegistrar,address,uint256,string,bytes32,string).revNodeHash (DomainManager.sol#50)' in DomainManager.buyDomain(IRegistrar,IReverseRegistrar,address,uint256,string,bytes32,string) (DomainManager.sol#40-58) potentially used before declaration: ReverseDomainClaimed(address(rev),revNodeHash) (DomainManager.sol#51)
Variable 'DomainManager.buyDomain(IRegistrar,IReverseRegistrar,address,uint256,string,bytes32,string).reason_scope_0 (DomainManager.sol#52)' in DomainManager.buyDomain(IRegistrar,IReverseRegistrar,address,uint256,string,bytes32,string) (DomainManager.sol#40-58) potentially used before declaration: ReverseDomainClaimError(reason_scope_0) (DomainManager.sol#53)
Variable 'DomainManager.reclaimReverseDomain(address,string).revNodeHash (DomainManager.sol#61)' in DomainManager.reclaimReverseDomain(address,string) (DomainManager.sol#60-70) potentially used before declaration: ReverseDomainClaimed(rev,revNodeHash) (DomainManager.sol#62)
Variable 'DomainManager.reclaimReverseDomain(address,string).reason (DomainManager.sol#64)' in DomainManager.reclaimReverseDomain(address,string) (DomainManager.sol#60-70) potentially used before declaration: ReverseDomainClaimError(reason) (DomainManager.sol#65)
Variable 'WalletGraph.reclaimDomainFromBacklink(IONEWallet[],uint32,IRegistrar,IReverseRegistrar,bytes).reason (WalletGraph.sol#79)' in WalletGraph.reclaimDomainFromBacklink(IONEWallet[],uint32,IRegistrar,IReverseRegistrar,bytes) (WalletGraph.sol#69-86) potentially used before declaration: CommandFailed(address(backlinkAddresses[backlinkIndex]),reason,commandData) (WalletGraph.sol#80)
Variable 'WalletGraph.command(IONEWallet[],Enums.TokenType,address,uint256,address,uint256,bytes).reason (WalletGraph.sol#96)' in WalletGraph.command(IONEWallet[],Enums.TokenType,address,uint256,address,uint256,bytes) (WalletGraph.sol#88-101) potentially used before declaration: CommandFailed(backlink,reason,commandData) (WalletGraph.sol#97)
Variable 'WalletGraph.batchUpdateForwardAddress(IONEWallet[],address).reason (WalletGraph.sol#107)' in WalletGraph.batchUpdateForwardAddress(IONEWallet[],address) (WalletGraph.sol#103-113) potentially used before declaration: BackLinkUpdateError(dest,address(backlinkAddresses[i]),reason) (WalletGraph.sol#108)
Variable 'ERC721._checkOnERC721Received(address,address,uint256,bytes).retval (@openzeppelin/contracts/token/ERC721/ERC721.sol#376)' in ERC721._checkOnERC721Received(address,address,uint256,bytes) (@openzeppelin/contracts/token/ERC721/ERC721.sol#369-390) potentially used before declaration: retval == IERC721Receiver(to).onERC721Received.selector (@openzeppelin/contracts/token/ERC721/ERC721.sol#377)
Variable 'ERC721._checkOnERC721Received(address,address,uint256,bytes).reason (@openzeppelin/contracts/token/ERC721/ERC721.sol#378)' in ERC721._checkOnERC721Received(address,address,uint256,bytes) (@openzeppelin/contracts/token/ERC721/ERC721.sol#369-390) potentially used before declaration: reason.length == 0 (@openzeppelin/contracts/token/ERC721/ERC721.sol#379)
Variable 'ERC721._checkOnERC721Received(address,address,uint256,bytes).reason (@openzeppelin/contracts/token/ERC721/ERC721.sol#378)' in ERC721._checkOnERC721Received(address,address,uint256,bytes) (@openzeppelin/contracts/token/ERC721/ERC721.sol#369-390) potentially used before declaration: revert(uint256,uint256)(32 + reason,mload(uint256)(reason)) (@openzeppelin/contracts/token/ERC721/ERC721.sol#383)
Variable 'ERC1155._doSafeTransferAcceptanceCheck(address,address,address,uint256,uint256,bytes).response (@openzeppelin/contracts/token/ERC1155/ERC1155.sol#410)' in ERC1155._doSafeTransferAcceptanceCheck(address,address,address,uint256,uint256,bytes) (@openzeppelin/contracts/token/ERC1155/ERC1155.sol#401-420) potentially used before declaration: response != IERC1155Receiver(to).onERC1155Received.selector (@openzeppelin/contracts/token/ERC1155/ERC1155.sol#411)
Variable 'ERC1155._doSafeTransferAcceptanceCheck(address,address,address,uint256,uint256,bytes).reason (@openzeppelin/contracts/token/ERC1155/ERC1155.sol#414)' in ERC1155._doSafeTransferAcceptanceCheck(address,address,address,uint256,uint256,bytes) (@openzeppelin/contracts/token/ERC1155/ERC1155.sol#401-420) potentially used before declaration: revert(string)(reason) (@openzeppelin/contracts/token/ERC1155/ERC1155.sol#415)
Variable 'ERC1155._doSafeBatchTransferAcceptanceCheck(address,address,address,uint256[],uint256[],bytes).response (@openzeppelin/contracts/token/ERC1155/ERC1155.sol#432)' in ERC1155._doSafeBatchTransferAcceptanceCheck(address,address,address,uint256[],uint256[],bytes) (@openzeppelin/contracts/token/ERC1155/ERC1155.sol#422-443) potentially used before declaration: response != IERC1155Receiver(to).onERC1155BatchReceived.selector (@openzeppelin/contracts/token/ERC1155/ERC1155.sol#434)
Variable 'ERC1155._doSafeBatchTransferAcceptanceCheck(address,address,address,uint256[],uint256[],bytes).reason (@openzeppelin/contracts/token/ERC1155/ERC1155.sol#437)' in ERC1155._doSafeBatchTransferAcceptanceCheck(address,address,address,uint256[],uint256[],bytes) (@openzeppelin/contracts/token/ERC1155/ERC1155.sol#422-443) potentially used before declaration: revert(string)(reason) (@openzeppelin/contracts/token/ERC1155/ERC1155.sol#438)
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#pre-declaration-usage-of-local-variables

Reentrancy in ONEWallet._drain() (ONEWallet.sol#219-227):
	External calls:
	- (success) = recoveryAddress.call{value: address(this).balance}() (ONEWallet.sol#221)
	State variables written after the call(s):
	- forwardAddress = recoveryAddress (ONEWallet.sol#223)
Reentrancy in TestERC1155.constructor(uint256[],uint256[],string[]) (debug/TestTokens.sol#95-102):
	External calls:
	- ERC1155._mint(msg.sender,tokenIds[i],amounts[i],) (debug/TestTokens.sol#99)
		- IERC1155Receiver(to).onERC1155Received(operator,from,id,amount,data) (@openzeppelin/contracts/token/ERC1155/ERC1155.sol#410-418)
	State variables written after the call(s):
	- metadataUris[tokenIds[i]] = uris_[i] (debug/TestTokens.sol#100)
Reentrancy in TestERC1155.mint(uint256,uint256,address,string) (debug/TestTokens.sol#107-110):
	External calls:
	- ERC1155._mint(dest,tokenId,amount,) (debug/TestTokens.sol#108)
		- IERC1155Receiver(to).onERC1155Received(operator,from,id,amount,data) (@openzeppelin/contracts/token/ERC1155/ERC1155.sol#410-418)
	State variables written after the call(s):
	- metadataUris[tokenId] = metadataUri (debug/TestTokens.sol#109)
Reentrancy in TestERC1155.payToMint(uint256,uint256,address,string) (debug/TestTokens.sol#112-120):
	External calls:
	- msg.sender.call{value: excess}() (debug/TestTokens.sol#116)
	- ERC1155._mint(dest,tokenId,amount,) (debug/TestTokens.sol#118)
		- IERC1155Receiver(to).onERC1155Received(operator,from,id,amount,data) (@openzeppelin/contracts/token/ERC1155/ERC1155.sol#410-418)
	External calls sending eth:
	- msg.sender.call{value: excess}() (debug/TestTokens.sol#116)
	State variables written after the call(s):
	- metadataUris[tokenId] = metadataUri (debug/TestTokens.sol#119)
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#reentrancy-vulnerabilities-2

Reentrancy in ONEWallet._callContract(address,uint256,bytes) (ONEWallet.sol#324-338):
	External calls:
	- (success,ret) = contractAddress.call{value: amount}(encodedWithSignature) (ONEWallet.sol#331)
	Event emitted after the call(s):
	- ExternalCallCompleted(contractAddress,amount,encodedWithSignature,ret) (ONEWallet.sol#333)
	- ExternalCallFailed(contractAddress,amount,encodedWithSignature,ret) (ONEWallet.sol#336)
Reentrancy in ONEWallet._forward(address) (ONEWallet.sol#190-216):
	External calls:
	- drainSuccess = _drain() (ONEWallet.sol#207)
		- (success) = recoveryAddress.call{value: address(this).balance}() (ONEWallet.sol#221)
		- IERC20(contractAddress).transfer(dest,amount) (TokenTracker.sol#120-131)
		- tokenTrackerState.recoverAllTokens(recoveryAddress) (ONEWallet.sol#224)
		- IERC721(contractAddress).safeTransferFrom(address(this),dest,tokenId,data) (TokenTracker.sol#133-139)
		- IERC1155(contractAddress).safeTransferFrom(address(this),dest,tokenId,amount,data) (TokenTracker.sol#141-147)
	External calls sending eth:
	- drainSuccess = _drain() (ONEWallet.sol#207)
		- (success) = recoveryAddress.call{value: address(this).balance}() (ONEWallet.sol#221)
	Event emitted after the call(s):
	- ForwardedBalance(drainSuccess) (ONEWallet.sol#208)
Reentrancy in ONEWallet._forwardPayment() (ONEWallet.sol#80-84):
	External calls:
	- (success) = forwardAddress.call{value: msg.value}() (ONEWallet.sol#81)
	Event emitted after the call(s):
	- PaymentForwarded(msg.value,msg.sender) (ONEWallet.sol#83)
Reentrancy in ONEWallet._recover() (ONEWallet.sol#247-262):
	External calls:
	- ! _drain() (ONEWallet.sol#256)
		- (success) = recoveryAddress.call{value: address(this).balance}() (ONEWallet.sol#221)
		- IERC20(contractAddress).transfer(dest,amount) (TokenTracker.sol#120-131)
		- tokenTrackerState.recoverAllTokens(recoveryAddress) (ONEWallet.sol#224)
		- IERC721(contractAddress).safeTransferFrom(address(this),dest,tokenId,data) (TokenTracker.sol#133-139)
		- IERC1155(contractAddress).safeTransferFrom(address(this),dest,tokenId,amount,data) (TokenTracker.sol#141-147)
	External calls sending eth:
	- ! _drain() (ONEWallet.sol#256)
		- (success) = recoveryAddress.call{value: address(this).balance}() (ONEWallet.sol#221)
	Event emitted after the call(s):
	- RecoveryTriggered() (ONEWallet.sol#260)
Reentrancy in ONEWallet._transfer(address,uint256) (ONEWallet.sol#229-244):
	External calls:
	- (success,ret) = dest.call{value: amount}() (ONEWallet.sol#235)
	Event emitted after the call(s):
	- PaymentSent(amount,dest) (ONEWallet.sol#242)
	- TransferError(dest,ret) (ONEWallet.sol#239)
Reentrancy in Executor._transferDomain(IRegistrar,address,bytes32,address) (Executor.sol#66-74):
	External calls:
	- DomainManager.transferDomain(reg,resolver,subnode,dest) (Executor.sol#67-73)
	Event emitted after the call(s):
	- DomainManager.DomainTransferFailed(reason) (Executor.sol#70)
	- DomainManager.DomainTransferFailed() (Executor.sol#72)
Reentrancy in WalletGraph.batchUpdateForwardAddress(IONEWallet[],address) (WalletGraph.sol#103-113):
	External calls:
	- backlinkAddresses[i].reveal(IONEWallet.AuthParams(new bytes32[](0),0,bytes32(0)),IONEWallet.OperationParams(Enums.OperationType.FORWARD,Enums.TokenType.NONE,address(0),0,dest,0,bytes())) (WalletGraph.sol#105-111)
	Event emitted after the call(s):
	- BackLinkUpdateError(dest,address(backlinkAddresses[i]),reason) (WalletGraph.sol#108)
	- BackLinkUpdateError(dest,address(backlinkAddresses[i]),) (WalletGraph.sol#110)
	- BackLinkUpdated(dest,address(backlinkAddresses[i])) (WalletGraph.sol#106)
Reentrancy in DomainManager.buyDomain(IRegistrar,IReverseRegistrar,address,uint256,string,bytes32,string) (DomainManager.sol#40-58):
	External calls:
	- (success,ret) = address(reg).call{value: maxPrice}(abi.encodeWithSignature(register(bytes32,string,address,uint256,string,address),node,subdomain,address(this),MIN_DOMAIN_RENT_DURATION,,resolver)) (DomainManager.sol#42)
	Event emitted after the call(s):
	- AttemptRegistration(node,subdomain,address(this),MIN_DOMAIN_RENT_DURATION,,resolver) (DomainManager.sol#43)
	- DomainRegistered(address(reg),subdomain,node) (DomainManager.sol#49)
	- DomainRegistrationFailed(reason) (DomainManager.sol#46)
Reentrancy in DomainManager.buyDomain(IRegistrar,IReverseRegistrar,address,uint256,string,bytes32,string) (DomainManager.sol#40-58):
	External calls:
	- (success,ret) = address(reg).call{value: maxPrice}(abi.encodeWithSignature(register(bytes32,string,address,uint256,string,address),node,subdomain,address(this),MIN_DOMAIN_RENT_DURATION,,resolver)) (DomainManager.sol#42)
	- rev.setName(fqdn) (DomainManager.sol#50-56)
	External calls sending eth:
	- (success,ret) = address(reg).call{value: maxPrice}(abi.encodeWithSignature(register(bytes32,string,address,uint256,string,address),node,subdomain,address(this),MIN_DOMAIN_RENT_DURATION,,resolver)) (DomainManager.sol#42)
	Event emitted after the call(s):
	- ReverseDomainClaimError(reason_scope_0) (DomainManager.sol#53)
	- ReverseDomainClaimError() (DomainManager.sol#55)
	- ReverseDomainClaimed(address(rev),revNodeHash) (DomainManager.sol#51)
Reentrancy in WalletGraph.command(IONEWallet[],Enums.TokenType,address,uint256,address,uint256,bytes) (WalletGraph.sol#88-101):
	External calls:
	- IONEWallet(backlink).reveal(IONEWallet.AuthParams(new bytes32[](0),0,bytes32(0)),IONEWallet.OperationParams(Enums.OperationType(operationType),tokenType,contractAddress,tokenId,dest,amount,commandData)) (WalletGraph.sol#94-100)
	Event emitted after the call(s):
	- CommandDispatched(backlink,commandData) (WalletGraph.sol#95)
	- CommandFailed(backlink,reason,commandData) (WalletGraph.sol#97)
	- CommandFailed(backlink,,commandData) (WalletGraph.sol#99)
Reentrancy in ONEWalletFactoryHelper.deploy(IONEWallet.InitParams) (FactoryHelper.sol#34-49):
	External calls:
	- addr = factory.deploy{value: msg.value}(salt,code) (FactoryHelper.sol#41)
	Event emitted after the call(s):
	- ONEWalletDeployFailed(salt,codeHash) (FactoryHelper.sol#43)
Reentrancy in ONEWalletFactoryHelper.deploy(IONEWallet.InitParams) (FactoryHelper.sol#34-49):
	External calls:
	- addr = factory.deploy{value: msg.value}(salt,code) (FactoryHelper.sol#41)
	- IONEWallet(addr).initialize(args) (FactoryHelper.sol#46)
	External calls sending eth:
	- addr = factory.deploy{value: msg.value}(salt,code) (FactoryHelper.sol#41)
	Event emitted after the call(s):
	- ONEWalletDeploySuccess(addr,salt,codeHash) (FactoryHelper.sol#47)
Reentrancy in TestERC1155.payToMint(uint256,uint256,address,string) (debug/TestTokens.sol#112-120):
	External calls:
	- msg.sender.call{value: excess}() (debug/TestTokens.sol#116)
	- ERC1155._mint(dest,tokenId,amount,) (debug/TestTokens.sol#118)
		- IERC1155Receiver(to).onERC1155Received(operator,from,id,amount,data) (@openzeppelin/contracts/token/ERC1155/ERC1155.sol#410-418)
	External calls sending eth:
	- msg.sender.call{value: excess}() (debug/TestTokens.sol#116)
	Event emitted after the call(s):
	- TransferSingle(operator,address(0),account,id,amount) (@openzeppelin/contracts/token/ERC1155/ERC1155.sol#275)
		- ERC1155._mint(dest,tokenId,amount,) (debug/TestTokens.sol#118)
Reentrancy in ONEWallet.receive() (ONEWallet.sol#86-123):
	External calls:
	- _forward(recoveryAddress) (ONEWallet.sol#95)
		- (success) = recoveryAddress.call{value: address(this).balance}() (ONEWallet.sol#221)
		- IERC20(contractAddress).transfer(dest,amount) (TokenTracker.sol#120-131)
		- tokenTrackerState.recoverAllTokens(recoveryAddress) (ONEWallet.sol#224)
		- backlinkAddresses[i].reveal(IONEWallet.AuthParams(new bytes32[](0),0,bytes32(0)),IONEWallet.OperationParams(Enums.OperationType.FORWARD,Enums.TokenType.NONE,address(0),0,dest,0,bytes())) (WalletGraph.sol#105-111)
		- (success,ret) = dest.call{value: amount}() (ONEWallet.sol#235)
		- tokenTrackerState.recoverAllTokens(dest) (ONEWallet.sol#213)
		- IERC721(contractAddress).safeTransferFrom(address(this),dest,tokenId,data) (TokenTracker.sol#133-139)
		- backlinkAddresses.batchUpdateForwardAddress(dest) (ONEWallet.sol#215)
		- IERC1155(contractAddress).safeTransferFrom(address(this),dest,tokenId,amount,data) (TokenTracker.sol#141-147)
	- _recover() (ONEWallet.sol#96)
		- (success) = recoveryAddress.call{value: address(this).balance}() (ONEWallet.sol#221)
		- IERC20(contractAddress).transfer(dest,amount) (TokenTracker.sol#120-131)
		- tokenTrackerState.recoverAllTokens(recoveryAddress) (ONEWallet.sol#224)
		- IERC721(contractAddress).safeTransferFrom(address(this),dest,tokenId,data) (TokenTracker.sol#133-139)
		- IERC1155(contractAddress).safeTransferFrom(address(this),dest,tokenId,amount,data) (TokenTracker.sol#141-147)
	External calls sending eth:
	- _forward(recoveryAddress) (ONEWallet.sol#95)
		- (success) = recoveryAddress.call{value: address(this).balance}() (ONEWallet.sol#221)
		- (success,ret) = dest.call{value: amount}() (ONEWallet.sol#235)
	- _recover() (ONEWallet.sol#96)
		- (success) = recoveryAddress.call{value: address(this).balance}() (ONEWallet.sol#221)
	Event emitted after the call(s):
	- BalanceRetrievalError(t.tokenType,t.contractAddress,t.tokenId,reason) (TokenTracker.sol#189)
		- _recover() (ONEWallet.sol#96)
	- LastResortAddressNotSet() (ONEWallet.sol#249)
		- _recover() (ONEWallet.sol#96)
	- RecoveryFailure() (ONEWallet.sol#257)
		- _recover() (ONEWallet.sol#96)
	- RecoveryTriggered() (ONEWallet.sol#260)
		- _recover() (ONEWallet.sol#96)
	- TokenRecovered(t.tokenType,t.contractAddress,t.tokenId,balance) (TokenTracker.sol#193)
		- _recover() (ONEWallet.sol#96)
	- TokenTracked(tokenType,contractAddress,tokenId) (TokenTracker.sol#45)
		- _recover() (ONEWallet.sol#96)
	- TokenTransferError(tokenType,contractAddress,tokenId,dest,amount,reason) (TokenTracker.sol#128)
		- _recover() (ONEWallet.sol#96)
	- TokenTransferError(tokenType,contractAddress,tokenId,dest,amount,) (TokenTracker.sol#130)
		- _recover() (ONEWallet.sol#96)
	- TokenTransferError(tokenType,contractAddress,tokenId,dest,amount,reason_scope_0) (TokenTracker.sol#136)
		- _recover() (ONEWallet.sol#96)
	- TokenTransferError(tokenType,contractAddress,tokenId,dest,amount,) (TokenTracker.sol#138)
		- _recover() (ONEWallet.sol#96)
	- TokenTransferError(tokenType,contractAddress,tokenId,dest,amount,reason_scope_1) (TokenTracker.sol#144)
		- _recover() (ONEWallet.sol#96)
	- TokenTransferError(tokenType,contractAddress,tokenId,dest,amount,) (TokenTracker.sol#146)
		- _recover() (ONEWallet.sol#96)
	- TokenTransferFailed(tokenType,contractAddress,tokenId,dest,amount) (TokenTracker.sol#126)
		- _recover() (ONEWallet.sol#96)
	- TokenTransferSucceeded(tokenType,contractAddress,tokenId,dest,amount) (TokenTracker.sol#123)
		- _recover() (ONEWallet.sol#96)
	- TokenTransferSucceeded(tokenType,contractAddress,tokenId,dest,amount) (TokenTracker.sol#134)
		- _recover() (ONEWallet.sol#96)
	- TokenTransferSucceeded(tokenType,contractAddress,tokenId,dest,amount) (TokenTracker.sol#142)
		- _recover() (ONEWallet.sol#96)
Reentrancy in WalletGraph.reclaimDomainFromBacklink(IONEWallet[],uint32,IRegistrar,IReverseRegistrar,bytes) (WalletGraph.sol#69-86):
	External calls:
	- backlinkAddresses[backlinkIndex].reveal(IONEWallet.AuthParams(new bytes32[](0),0,bytes32(0)),IONEWallet.OperationParams(Enums.OperationType.TRANSFER_DOMAIN,Enums.TokenType.NONE,address(reg),uint256(bytes32(bytes20(resolver))),address(address(this)),uint256(subnode),)) (WalletGraph.sol#77-83)
	Event emitted after the call(s):
	- CommandDispatched(address(backlinkAddresses[backlinkIndex]),commandData) (WalletGraph.sol#78)
	- CommandFailed(address(backlinkAddresses[backlinkIndex]),reason,commandData) (WalletGraph.sol#80)
	- CommandFailed(address(backlinkAddresses[backlinkIndex]),,commandData) (WalletGraph.sol#82)
Reentrancy in DomainManager.reclaimReverseDomain(address,string) (DomainManager.sol#60-70):
	External calls:
	- IReverseRegistrar(rev).setName(fqdn) (DomainManager.sol#61-68)
	Event emitted after the call(s):
	- ReverseDomainClaimError(reason) (DomainManager.sol#65)
	- ReverseDomainClaimError() (DomainManager.sol#67)
	- ReverseDomainClaimed(rev,revNodeHash) (DomainManager.sol#62)
Reentrancy in TokenTracker.recoverToken(TokenTracker.TokenTrackerState,address,TokenTracker.TrackedToken) (TokenTracker.sol#186-195):
	External calls:
	- transferToken(state,t.tokenType,t.contractAddress,t.tokenId,dest,balance,bytes()) (TokenTracker.sol#192)
		- IERC20(contractAddress).transfer(dest,amount) (TokenTracker.sol#120-131)
		- IERC721(contractAddress).safeTransferFrom(address(this),dest,tokenId,data) (TokenTracker.sol#133-139)
		- IERC1155(contractAddress).safeTransferFrom(address(this),dest,tokenId,amount,data) (TokenTracker.sol#141-147)
	Event emitted after the call(s):
	- TokenRecovered(t.tokenType,t.contractAddress,t.tokenId,balance) (TokenTracker.sol#193)
Reentrancy in DomainManager.renewDomain(IRegistrar,bytes32,string,uint256) (DomainManager.sol#80-90):
	External calls:
	- (success,ret) = address(reg).call{value: maxPrice}(abi.encodeWithSignature(renew(bytes32,string,uint256),node,subdomain,MIN_DOMAIN_RENT_DURATION)) (DomainManager.sol#81)
	Event emitted after the call(s):
	- AttemptRenewal(node,subdomain,MIN_DOMAIN_RENT_DURATION) (DomainManager.sol#82)
	- DomainRenewalFailed(reason) (DomainManager.sol#85)
	- DomainRenewed(node,subdomain,MIN_DOMAIN_RENT_DURATION) (DomainManager.sol#88)
Reentrancy in ONEWallet.retire() (ONEWallet.sol#125-132):
	External calls:
	- require(bool)(_drain()) (ONEWallet.sol#129)
		- (success) = recoveryAddress.call{value: address(this).balance}() (ONEWallet.sol#221)
		- IERC20(contractAddress).transfer(dest,amount) (TokenTracker.sol#120-131)
		- tokenTrackerState.recoverAllTokens(recoveryAddress) (ONEWallet.sol#224)
		- IERC721(contractAddress).safeTransferFrom(address(this),dest,tokenId,data) (TokenTracker.sol#133-139)
		- IERC1155(contractAddress).safeTransferFrom(address(this),dest,tokenId,amount,data) (TokenTracker.sol#141-147)
	External calls sending eth:
	- require(bool)(_drain()) (ONEWallet.sol#129)
		- (success) = recoveryAddress.call{value: address(this).balance}() (ONEWallet.sol#221)
	Event emitted after the call(s):
	- Retired() (ONEWallet.sol#130)
Reentrancy in DomainManager.transferDomain(IRegistrar,address,bytes32,address) (DomainManager.sol#73-78):
	External calls:
	- Resolver(resolver).setAddr(subnode,dest) (DomainManager.sol#75)
	- ENS(ens).setOwner(subnode,dest) (DomainManager.sol#76)
	Event emitted after the call(s):
	- DomainTransferred(subnode,dest) (DomainManager.sol#77)
Reentrancy in TokenTracker.transferToken(TokenTracker.TokenTrackerState,Enums.TokenType,address,uint256,address,uint256,bytes) (TokenTracker.sol#118-149):
	External calls:
	- IERC20(contractAddress).transfer(dest,amount) (TokenTracker.sol#120-131)
	Event emitted after the call(s):
	- TokenTracked(tokenType,contractAddress,tokenId) (TokenTracker.sol#45)
		- trackToken(state,tokenType,contractAddress,tokenId) (TokenTracker.sol#122)
	- TokenTransferError(tokenType,contractAddress,tokenId,dest,amount,reason) (TokenTracker.sol#128)
	- TokenTransferError(tokenType,contractAddress,tokenId,dest,amount,) (TokenTracker.sol#130)
	- TokenTransferFailed(tokenType,contractAddress,tokenId,dest,amount) (TokenTracker.sol#126)
	- TokenTransferSucceeded(tokenType,contractAddress,tokenId,dest,amount) (TokenTracker.sol#123)
Reentrancy in TokenTracker.transferToken(TokenTracker.TokenTrackerState,Enums.TokenType,address,uint256,address,uint256,bytes) (TokenTracker.sol#118-149):
	External calls:
	- IERC721(contractAddress).safeTransferFrom(address(this),dest,tokenId,data) (TokenTracker.sol#133-139)
	Event emitted after the call(s):
	- TokenTransferError(tokenType,contractAddress,tokenId,dest,amount,reason_scope_0) (TokenTracker.sol#136)
	- TokenTransferError(tokenType,contractAddress,tokenId,dest,amount,) (TokenTracker.sol#138)
	- TokenTransferSucceeded(tokenType,contractAddress,tokenId,dest,amount) (TokenTracker.sol#134)
Reentrancy in TokenTracker.transferToken(TokenTracker.TokenTrackerState,Enums.TokenType,address,uint256,address,uint256,bytes) (TokenTracker.sol#118-149):
	External calls:
	- IERC1155(contractAddress).safeTransferFrom(address(this),dest,tokenId,amount,data) (TokenTracker.sol#141-147)
	Event emitted after the call(s):
	- TokenTransferError(tokenType,contractAddress,tokenId,dest,amount,reason_scope_1) (TokenTracker.sol#144)
	- TokenTransferError(tokenType,contractAddress,tokenId,dest,amount,) (TokenTracker.sol#146)
	- TokenTransferSucceeded(tokenType,contractAddress,tokenId,dest,amount) (TokenTracker.sol#142)
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#reentrancy-vulnerabilities-3

CommitManager.cleanupCommits(CommitManager.CommitState) (CommitManager.sol#132-177) uses timestamp for comparisons
	Dangerous comparisons:
	- c.timestamp >= bt - REVEAL_MAX_DELAY (CommitManager.sol#146)
CommitManager.cleanupNonces(CommitManager.CommitState,uint8) (CommitManager.sol#194-216) uses timestamp for comparisons
	Dangerous comparisons:
	- index < indexMin (CommitManager.sol#201)
Reveal.verifyReveal(IONEWallet.CoreSetting,CommitManager.CommitState,bytes32,uint32,bytes32,bytes32,bool,bool) (Reveal.sol#127-157) uses timestamp for comparisons
	Dangerous comparisons:
	- require(bool,string)(uint32(block.timestamp) - c.timestamp < CommitManager.REVEAL_MAX_DELAY,Too late) (Reveal.sol#153)
SignatureManager.revokeBefore(SignatureManager.SignatureTracker,uint32) (SignatureManager.sol#71-95) uses timestamp for comparisons
	Dangerous comparisons:
	- s.expireAt > beforeTime (SignatureManager.sol#77)
SignatureManager.validate(SignatureManager.SignatureTracker,bytes32,bytes32) (SignatureManager.sol#126-138) uses timestamp for comparisons
	Dangerous comparisons:
	- s.expireAt < block.timestamp (SignatureManager.sol#134)
SpendingManager.getRemainingAllowance(SpendingManager.SpendingState) (SpendingManager.sol#22-29) uses timestamp for comparisons
	Dangerous comparisons:
	- interval > ss.lastSpendingInterval (SpendingManager.sol#24)
SpendingManager.accountSpending(SpendingManager.SpendingState,uint256) (SpendingManager.sol#61-68) uses timestamp for comparisons
	Dangerous comparisons:
	- interval > ss.lastSpendingInterval (SpendingManager.sol#63)
SpendingManager.changeSpendLimit(SpendingManager.SpendingState,uint256) (SpendingManager.sol#70-86) uses timestamp for comparisons
	Dangerous comparisons:
	- ss.lastLimitAdjustmentTime + ss.spendingInterval > block.timestamp && newLimit > ss.spendingLimit (SpendingManager.sol#71)
	- newLimit > ss.highestSpendingLimit (SpendingManager.sol#82)
ONEWallet.receive() (ONEWallet.sol#86-123) uses timestamp for comparisons
	Dangerous comparisons:
	- block.timestamp < lastOperationTime + Recovery.AUTO_RECOVERY_MANDATORY_WAIT_TIME (ONEWallet.sol#117)
ONEWallet.retire() (ONEWallet.sol#125-132) uses timestamp for comparisons
	Dangerous comparisons:
	- require(bool)(uint32(block.timestamp / core.interval) - core.t0 > core.lifespan) (ONEWallet.sol#127)
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#block-timestamp

DomainManager._revertReason(bytes) (DomainManager.sol#93-103) uses assembly
	- INLINE ASM (DomainManager.sol#96-99)
ONEWalletFactory.hasCode(address) (Factory.sol#13-19) uses assembly
	- INLINE ASM (Factory.sol#15-17)
ONEWalletFactory.deploy(uint256,bytes) (Factory.sol#22-31) uses assembly
	- INLINE ASM (Factory.sol#24-26)
Address.isContract(address) (@openzeppelin/contracts/utils/Address.sol#26-36) uses assembly
	- INLINE ASM (@openzeppelin/contracts/utils/Address.sol#32-34)
Address._verifyCallResult(bool,bytes,string) (@openzeppelin/contracts/utils/Address.sol#189-209) uses assembly
	- INLINE ASM (@openzeppelin/contracts/utils/Address.sol#201-204)
ERC721._checkOnERC721Received(address,address,uint256,bytes) (@openzeppelin/contracts/token/ERC721/ERC721.sol#369-390) uses assembly
	- INLINE ASM (@openzeppelin/contracts/token/ERC721/ERC721.sol#382-384)
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#assembly-usage

Different versions of Solidity is used:
	- Version used: ['>=0.8.0', '>=0.8.4', '^0.8.0', '^0.8.4']
	- ^0.8.4 (debug/Registrar.sol#2)
	- ^0.8.4 (Version.sol#2)
	- ^0.8.0 (@openzeppelin/contracts/utils/introspection/IERC165.sol#3)
	- >=0.8.0 (debug/TestTokens.sol#2)
	- ^0.8.0 (@openzeppelin/contracts/token/ERC1155/IERC1155.sol#3)
	- ^0.8.0 (@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol#3)
	- ^0.8.4 (Executor.sol#2)
	- ^0.8.4 (CommitManager.sol#2)
	- ^0.8.4 (IONEWallet.sol#2)
	- ^0.8.4 (Reveal.sol#2)
	- ^0.8.0 (@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol#3)
	- ^0.8.4 (TokenTracker.sol#2)
	- ^0.8.4 (DomainManager.sol#2)
	- ^0.8.4 (SignatureManager.sol#2)
	- ^0.8.4 (WalletGraph.sol#2)
	- ^0.8.4 (Factory.sol#2)
	- ^0.8.4 (Forwardable.sol#2)
	- ^0.8.0 (@openzeppelin/contracts/utils/introspection/ERC165.sol#3)
	- ^0.8.4 (AbstractONEWallet.sol#2)
	- ^0.8.0 (@openzeppelin/contracts/utils/Address.sol#3)
	- ^0.8.4 (FactoryHelper.sol#2)
	- ^0.8.0 (@openzeppelin/contracts/token/ERC721/ERC721.sol#3)
	- ^0.8.4 (@ensdomains/subdomain-registrar-core/contracts/interfaces/IDefaultReverseResolver.sol#2)
	- ^0.8.0 (@openzeppelin/contracts/token/ERC721/extensions/IERC721Metadata.sol#3)
	- ^0.8.0 (@openzeppelin/contracts/token/ERC1155/extensions/IERC1155MetadataURI.sol#3)
	- >=0.8.4 (@ensdomains/subdomain-registrar-core/contracts/interfaces/IReverseRegistrar.sol#2)
	- ^0.8.4 (SpendingManager.sol#2)
	- ^0.8.0 (@openzeppelin/contracts/utils/Context.sol#3)
	- ^0.8.4 (TokenManager.sol#2)
	- ^0.8.0 (@openzeppelin/contracts/utils/Strings.sol#3)
	- ^0.8.4 (CoreManager.sol#2)
	- >=0.8.4 (@ensdomains/subdomain-registrar-core/contracts/interfaces/IRegistrar.sol#2)
	- >=0.8.4 (@ensdomains/subdomain-registrar-core/contracts/interfaces/ENS.sol#2)
	- >=0.8.4 (@ensdomains/subdomain-registrar-core/contracts/Resolver.sol#2)
	- ^0.8.0 (@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol#3)
	- ^0.8.0 (@openzeppelin/contracts/token/ERC1155/ERC1155.sol#3)
	- ^0.8.4 (Recovery.sol#2)
	- ^0.8.0 (@openzeppelin/contracts/token/ERC721/IERC721.sol#3)
	- ^0.8.0 (@openzeppelin/contracts/token/ERC20/ERC20.sol#3)
	- ^0.8.0 (@openzeppelin/contracts/token/ERC20/IERC20.sol#3)
	- ^0.8.4 (Enums.sol#2)
	- ^0.8.4 (ONEWallet.sol#2)
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#different-pragma-directives-are-used

Forwardable._getForwardAddress() (Forwardable.sol#5-7) is never used and should be removed
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#dead-code

Pragma version^0.8.0 (@openzeppelin/contracts/utils/introspection/IERC165.sol#3) allows old versions
Pragma version>=0.8.0 (debug/TestTokens.sol#2) allows old versions
Pragma version^0.8.0 (@openzeppelin/contracts/token/ERC1155/IERC1155.sol#3) allows old versions
Pragma version^0.8.0 (@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol#3) allows old versions
Pragma version^0.8.0 (@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol#3) allows old versions
Pragma version^0.8.0 (@openzeppelin/contracts/utils/introspection/ERC165.sol#3) allows old versions
Pragma version^0.8.0 (@openzeppelin/contracts/utils/Address.sol#3) allows old versions
Pragma version^0.8.0 (@openzeppelin/contracts/token/ERC721/ERC721.sol#3) allows old versions
Pragma version^0.8.0 (@openzeppelin/contracts/token/ERC721/extensions/IERC721Metadata.sol#3) allows old versions
Pragma version^0.8.0 (@openzeppelin/contracts/token/ERC1155/extensions/IERC1155MetadataURI.sol#3) allows old versions
Pragma version^0.8.0 (@openzeppelin/contracts/utils/Context.sol#3) allows old versions
Pragma version^0.8.0 (@openzeppelin/contracts/utils/Strings.sol#3) allows old versions
Pragma version^0.8.0 (@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol#3) allows old versions
Pragma version^0.8.0 (@openzeppelin/contracts/token/ERC1155/ERC1155.sol#3) allows old versions
Pragma version^0.8.0 (@openzeppelin/contracts/token/ERC721/IERC721.sol#3) allows old versions
Pragma version^0.8.0 (@openzeppelin/contracts/token/ERC20/ERC20.sol#3) allows old versions
Pragma version^0.8.0 (@openzeppelin/contracts/token/ERC20/IERC20.sol#3) allows old versions
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#incorrect-versions-of-solidity

Low level call in TestERC1155.payToMint(uint256,uint256,address,string) (debug/TestTokens.sol#112-120):
	- msg.sender.call{value: excess}() (debug/TestTokens.sol#116)
Low level call in DomainManager.buyDomain(IRegistrar,IReverseRegistrar,address,uint256,string,bytes32,string) (DomainManager.sol#40-58):
	- (success,ret) = address(reg).call{value: maxPrice}(abi.encodeWithSignature(register(bytes32,string,address,uint256,string,address),node,subdomain,address(this),MIN_DOMAIN_RENT_DURATION,,resolver)) (DomainManager.sol#42)
Low level call in DomainManager.renewDomain(IRegistrar,bytes32,string,uint256) (DomainManager.sol#80-90):
	- (success,ret) = address(reg).call{value: maxPrice}(abi.encodeWithSignature(renew(bytes32,string,uint256),node,subdomain,MIN_DOMAIN_RENT_DURATION)) (DomainManager.sol#81)
Low level call in Address.sendValue(address,uint256) (@openzeppelin/contracts/utils/Address.sol#54-59):
	- (success) = recipient.call{value: amount}() (@openzeppelin/contracts/utils/Address.sol#57)
Low level call in Address.functionCallWithValue(address,bytes,uint256,string) (@openzeppelin/contracts/utils/Address.sol#122-133):
	- (success,returndata) = target.call{value: value}(data) (@openzeppelin/contracts/utils/Address.sol#131)
Low level call in Address.functionStaticCall(address,bytes,string) (@openzeppelin/contracts/utils/Address.sol#151-160):
	- (success,returndata) = target.staticcall(data) (@openzeppelin/contracts/utils/Address.sol#158)
Low level call in Address.functionDelegateCall(address,bytes,string) (@openzeppelin/contracts/utils/Address.sol#178-187):
	- (success,returndata) = target.delegatecall(data) (@openzeppelin/contracts/utils/Address.sol#185)
Low level call in ONEWallet._forwardPayment() (ONEWallet.sol#80-84):
	- (success) = forwardAddress.call{value: msg.value}() (ONEWallet.sol#81)
Low level call in ONEWallet._drain() (ONEWallet.sol#219-227):
	- (success) = recoveryAddress.call{value: address(this).balance}() (ONEWallet.sol#221)
Low level call in ONEWallet._transfer(address,uint256) (ONEWallet.sol#229-244):
	- (success,ret) = dest.call{value: amount}() (ONEWallet.sol#235)
Low level call in ONEWallet._callContract(address,uint256,bytes) (ONEWallet.sol#324-338):
	- (success,ret) = contractAddress.call{value: amount}(encodedWithSignature) (ONEWallet.sol#331)
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#low-level-calls

Constant Version.majorVersion (Version.sol#6) is not in UPPER_CASE_WITH_UNDERSCORES
Constant Version.minorVersion (Version.sol#7) is not in UPPER_CASE_WITH_UNDERSCORES
Parameter ERC721.safeTransferFrom(address,address,uint256,bytes)._data (@openzeppelin/contracts/token/ERC721/ERC721.sol#181) is not in mixedCase
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#conformance-to-solidity-naming-conventions

Variable TokenTracker.transferToken(TokenTracker.TokenTrackerState,Enums.TokenType,address,uint256,address,uint256,bytes).reason_scope_0 (TokenTracker.sol#135) is too similar to TokenTracker.transferToken(TokenTracker.TokenTrackerState,Enums.TokenType,address,uint256,address,uint256,bytes).reason_scope_1 (TokenTracker.sol#143)
Variable TokenTracker.getBalance(Enums.TokenType,address,uint256).reason_scope_0 (TokenTracker.sol#169) is too similar to TokenTracker.transferToken(TokenTracker.TokenTrackerState,Enums.TokenType,address,uint256,address,uint256,bytes).reason_scope_1 (TokenTracker.sol#143)
Variable TokenTracker.transferToken(TokenTracker.TokenTrackerState,Enums.TokenType,address,uint256,address,uint256,bytes).reason_scope_0 (TokenTracker.sol#135) is too similar to TokenTracker.getBalance(Enums.TokenType,address,uint256).reason_scope_2 (TokenTracker.sol#177)
Variable TokenTracker.getBalance(Enums.TokenType,address,uint256).reason_scope_0 (TokenTracker.sol#169) is too similar to TokenTracker.getBalance(Enums.TokenType,address,uint256).reason_scope_2 (TokenTracker.sol#177)
Variable TokenTracker.transferToken(TokenTracker.TokenTrackerState,Enums.TokenType,address,uint256,address,uint256,bytes).reason_scope_1 (TokenTracker.sol#143) is too similar to TokenTracker.getBalance(Enums.TokenType,address,uint256).reason_scope_2 (TokenTracker.sol#177)
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#variable-names-are-too-similar

ONEWalletCodeHelper.code() (FactoryHelper.sol#10-12) uses literals with too many digits:
	- type()(ONEWallet).creationCode (FactoryHelper.sol#11)
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#too-many-digits

mint(address,uint256) should be declared external:
	- TestERC20.mint(address,uint256) (debug/TestTokens.sol#21-23)
burn(address,uint256) should be declared external:
	- TestERC20.burn(address,uint256) (debug/TestTokens.sol#25-27)
mint(address,uint256) should be declared external:
	- TestERC20Decimals9.mint(address,uint256) (debug/TestTokens.sol#43-45)
burn(address,uint256) should be declared external:
	- TestERC20Decimals9.burn(address,uint256) (debug/TestTokens.sol#47-49)
decimals() should be declared external:
	- ERC20.decimals() (@openzeppelin/contracts/token/ERC20/ERC20.sol#85-87)
	- TestERC20Decimals9.decimals() (debug/TestTokens.sol#51-53)
tokenURI(uint256) should be declared external:
	- ERC721.tokenURI(uint256) (@openzeppelin/contracts/token/ERC721/ERC721.sol#92-97)
	- TestERC721.tokenURI(uint256) (debug/TestTokens.sol#87-89)
mint(uint256,uint256,address,string) should be declared external:
	- TestERC1155.mint(uint256,uint256,address,string) (debug/TestTokens.sol#107-110)
setUri(uint256,string) should be declared external:
	- TestERC1155.setUri(uint256,string) (debug/TestTokens.sol#122-124)
uri(uint256) should be declared external:
	- ERC1155.uri(uint256) (@openzeppelin/contracts/token/ERC1155/ERC1155.sol#58-60)
	- TestERC1155.uri(uint256) (debug/TestTokens.sol#126-128)
burn(address,uint256,uint256) should be declared external:
	- TestERC1155.burn(address,uint256,uint256) (debug/TestTokens.sol#130-132)
execute(IONEWallet.OperationParams,TokenTracker.TokenTrackerState,IONEWallet[],SignatureManager.SignatureTracker,SpendingManager.SpendingState) should be declared external:
	- Executor.execute(IONEWallet.OperationParams,TokenTracker.TokenTrackerState,IONEWallet[],SignatureManager.SignatureTracker,SpendingManager.SpendingState) (Executor.sol#17-64)
getAllCommits(CommitManager.CommitState) should be declared external:
	- CommitManager.getAllCommits(CommitManager.CommitState) (CommitManager.sol#103-111)
isNonRecoveryLeaf(IONEWallet.CoreSetting,IONEWallet.CoreSetting[],uint32,uint32) should be declared external:
	- Reveal.isNonRecoveryLeaf(IONEWallet.CoreSetting,IONEWallet.CoreSetting[],uint32,uint32) (Reveal.sol#90-98)
authenticate(IONEWallet.CoreSetting,IONEWallet.CoreSetting[],IONEWallet.CoreSetting[],address,CommitManager.CommitState,IONEWallet.AuthParams,IONEWallet.OperationParams) should be declared external:
	- Reveal.authenticate(IONEWallet.CoreSetting,IONEWallet.CoreSetting[],IONEWallet.CoreSetting[],address,CommitManager.CommitState,IONEWallet.AuthParams,IONEWallet.OperationParams) (Reveal.sol#173-205)
overrideTrackWithBytes(TokenTracker.TokenTrackerState,bytes) should be declared external:
	- TokenTracker.overrideTrackWithBytes(TokenTracker.TokenTrackerState,bytes) (TokenTracker.sol#95-102)
multiTrack(TokenTracker.TokenTrackerState,bytes) should be declared external:
	- TokenTracker.multiTrack(TokenTracker.TokenTrackerState,bytes) (TokenTracker.sol#104-109)
multiUntrack(TokenTracker.TokenTrackerState,bytes) should be declared external:
	- TokenTracker.multiUntrack(TokenTracker.TokenTrackerState,bytes) (TokenTracker.sol#111-116)
recoverSelectedTokensEncoded(TokenTracker.TokenTrackerState,address,bytes) should be declared external:
	- TokenTracker.recoverSelectedTokensEncoded(TokenTracker.TokenTrackerState,address,bytes) (TokenTracker.sol#197-202)
recoverAllTokens(TokenTracker.TokenTrackerState,address) should be declared external:
	- TokenTracker.recoverAllTokens(TokenTracker.TokenTrackerState,address) (TokenTracker.sol#204-208)
getTrackedTokens(TokenTracker.TokenTrackerState) should be declared external:
	- TokenTracker.getTrackedTokens(TokenTracker.TokenTrackerState) (TokenTracker.sol#210-220)
buyDomainEncoded(bytes,uint256,uint8,address,address) should be declared external:
	- DomainManager.buyDomainEncoded(bytes,uint256,uint8,address,address) (DomainManager.sol#25-38)
reclaimReverseDomain(address,string) should be declared external:
	- DomainManager.reclaimReverseDomain(address,string) (DomainManager.sol#60-70)
transferDomain(IRegistrar,address,bytes32,address) should be declared external:
	- DomainManager.transferDomain(IRegistrar,address,bytes32,address) (DomainManager.sol#73-78)
renewDomain(IRegistrar,bytes32,string,uint256) should be declared external:
	- DomainManager.renewDomain(IRegistrar,bytes32,string,uint256) (DomainManager.sol#80-90)
revokeHandler(SignatureManager.SignatureTracker,address,uint256,address,uint256) should be declared external:
	- SignatureManager.revokeHandler(SignatureManager.SignatureTracker,address,uint256,address,uint256) (SignatureManager.sol#106-117)
authorizeHandler(SignatureManager.SignatureTracker,address,uint256,address,uint256) should be declared external:
	- SignatureManager.authorizeHandler(SignatureManager.SignatureTracker,address,uint256,address,uint256) (SignatureManager.sol#119-124)
lookup(SignatureManager.SignatureTracker,bytes32) should be declared external:
	- SignatureManager.lookup(SignatureManager.SignatureTracker,bytes32) (SignatureManager.sol#140-143)
isValidSignature(SignatureManager.SignatureTracker,bytes32,bytes) should be declared external:
	- SignatureManager.isValidSignature(SignatureManager.SignatureTracker,bytes32,bytes) (SignatureManager.sol#161-178)
reclaimDomainFromBacklink(IONEWallet[],uint32,IRegistrar,IReverseRegistrar,bytes) should be declared external:
	- WalletGraph.reclaimDomainFromBacklink(IONEWallet[],uint32,IRegistrar,IReverseRegistrar,bytes) (WalletGraph.sol#69-86)
command(IONEWallet[],Enums.TokenType,address,uint256,address,uint256,bytes) should be declared external:
	- WalletGraph.command(IONEWallet[],Enums.TokenType,address,uint256,address,uint256,bytes) (WalletGraph.sol#88-101)
batchUpdateForwardAddress(IONEWallet[],address) should be declared external:
	- WalletGraph.batchUpdateForwardAddress(IONEWallet[],address) (WalletGraph.sol#103-113)
predict(uint256,bytes) should be declared external:
	- ONEWalletFactory.predict(uint256,bytes) (Factory.sol#7-11)
hasCode(address) should be declared external:
	- ONEWalletFactory.hasCode(address) (Factory.sol#13-19)
deploy(uint256,bytes) should be declared external:
	- ONEWalletFactory.deploy(uint256,bytes) (Factory.sol#22-31)
code() should be declared external:
	- ONEWalletCodeHelper.code() (FactoryHelper.sol#10-12)
getVersion() should be declared external:
	- ONEWalletFactoryHelper.getVersion() (FactoryHelper.sol#30-32)
deploy(IONEWallet.InitParams) should be declared external:
	- ONEWalletFactoryHelper.deploy(IONEWallet.InitParams) (FactoryHelper.sol#34-49)
predict(bytes) should be declared external:
	- ONEWalletFactoryHelper.predict(bytes) (FactoryHelper.sol#51-53)
getCode() should be declared external:
	- ONEWalletFactoryHelper.getCode() (FactoryHelper.sol#55-57)
verify(IONEWallet) should be declared external:
	- ONEWalletFactoryHelper.verify(IONEWallet) (FactoryHelper.sol#59-62)
balanceOf(address) should be declared external:
	- ERC721.balanceOf(address) (@openzeppelin/contracts/token/ERC721/ERC721.sol#61-64)
name() should be declared external:
	- ERC721.name() (@openzeppelin/contracts/token/ERC721/ERC721.sol#78-80)
symbol() should be declared external:
	- ERC721.symbol() (@openzeppelin/contracts/token/ERC721/ERC721.sol#85-87)
approve(address,uint256) should be declared external:
	- ERC721.approve(address,uint256) (@openzeppelin/contracts/token/ERC721/ERC721.sol#111-121)
setApprovalForAll(address,bool) should be declared external:
	- ERC721.setApprovalForAll(address,bool) (@openzeppelin/contracts/token/ERC721/ERC721.sol#135-140)
transferFrom(address,address,uint256) should be declared external:
	- ERC721.transferFrom(address,address,uint256) (@openzeppelin/contracts/token/ERC721/ERC721.sol#152-161)
safeTransferFrom(address,address,uint256) should be declared external:
	- ERC721.safeTransferFrom(address,address,uint256) (@openzeppelin/contracts/token/ERC721/ERC721.sol#166-172)
displace(IONEWallet.CoreSetting[],IONEWallet.CoreSetting[],IONEWallet.CoreSetting,bytes[],bytes,address) should be declared external:
	- CoreManager.displace(IONEWallet.CoreSetting[],IONEWallet.CoreSetting[],IONEWallet.CoreSetting,bytes[],bytes,address) (CoreManager.sol#11-26)
supportsInterface(bytes4) should be declared external:
	- Resolver.supportsInterface(bytes4) (@ensdomains/subdomain-registrar-core/contracts/Resolver.sol#10)
addr(bytes32) should be declared external:
	- Resolver.addr(bytes32) (@ensdomains/subdomain-registrar-core/contracts/Resolver.sol#11)
setAddr(bytes32,address) should be declared external:
	- Resolver.setAddr(bytes32,address) (@ensdomains/subdomain-registrar-core/contracts/Resolver.sol#12)
balanceOfBatch(address[],uint256[]) should be declared external:
	- ERC1155.balanceOfBatch(address[],uint256[]) (@openzeppelin/contracts/token/ERC1155/ERC1155.sol#81-97)
setApprovalForAll(address,bool) should be declared external:
	- ERC1155.setApprovalForAll(address,bool) (@openzeppelin/contracts/token/ERC1155/ERC1155.sol#102-107)
safeTransferFrom(address,address,uint256,uint256,bytes) should be declared external:
	- ERC1155.safeTransferFrom(address,address,uint256,uint256,bytes) (@openzeppelin/contracts/token/ERC1155/ERC1155.sol#119-131)
safeBatchTransferFrom(address,address,uint256[],uint256[],bytes) should be declared external:
	- ERC1155.safeBatchTransferFrom(address,address,uint256[],uint256[],bytes) (@openzeppelin/contracts/token/ERC1155/ERC1155.sol#136-148)
name() should be declared external:
	- ERC20.name() (@openzeppelin/contracts/token/ERC20/ERC20.sol#60-62)
symbol() should be declared external:
	- ERC20.symbol() (@openzeppelin/contracts/token/ERC20/ERC20.sol#68-70)
totalSupply() should be declared external:
	- ERC20.totalSupply() (@openzeppelin/contracts/token/ERC20/ERC20.sol#92-94)
balanceOf(address) should be declared external:
	- ERC20.balanceOf(address) (@openzeppelin/contracts/token/ERC20/ERC20.sol#99-101)
transfer(address,uint256) should be declared external:
	- ERC20.transfer(address,uint256) (@openzeppelin/contracts/token/ERC20/ERC20.sol#111-114)
allowance(address,address) should be declared external:
	- ERC20.allowance(address,address) (@openzeppelin/contracts/token/ERC20/ERC20.sol#119-121)
approve(address,uint256) should be declared external:
	- ERC20.approve(address,uint256) (@openzeppelin/contracts/token/ERC20/ERC20.sol#130-133)
transferFrom(address,address,uint256) should be declared external:
	- ERC20.transferFrom(address,address,uint256) (@openzeppelin/contracts/token/ERC20/ERC20.sol#148-162)
increaseAllowance(address,uint256) should be declared external:
	- ERC20.increaseAllowance(address,uint256) (@openzeppelin/contracts/token/ERC20/ERC20.sol#176-179)
decreaseAllowance(address,uint256) should be declared external:
	- ERC20.decreaseAllowance(address,uint256) (@openzeppelin/contracts/token/ERC20/ERC20.sol#195-203)
isValidSignature(bytes32,bytes) should be declared external:
	- ONEWallet.isValidSignature(bytes32,bytes) (ONEWallet.sol#358-360)
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#public-function-that-could-be-declared-external
. analyzed (48 contracts with 77 detectors), 230 result(s) found
johnlaptop code (testing) $
```