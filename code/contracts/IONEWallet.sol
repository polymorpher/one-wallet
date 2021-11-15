// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.4;

import "./Enums.sol";
import "./SpendingManager.sol";

interface IONEWallet {
    struct CoreSetting {
        /// Some variables can be immutable, but doing so would increase contract size. We are at threshold at the moment (~24KiB) so until we separate the contracts, we will do everything to minimize contract size
        bytes32 root; // Note: @ivan brought up a good point in reducing this to 16-bytes so hash of two consecutive nodes can be done in a single word (to save gas and reduce blockchain clutter). Let's not worry about that for now and re-evalaute this later.
        uint8 height; // including the root. e.g. for a tree with 4 leaves, the height is 3.
        uint8 interval; // otp interval in seconds, default is 30
        uint32 t0; // starting time block (effectiveTime (in ms) / interval)
        uint32 lifespan;  // in number of block (e.g. 1 block per [interval] seconds)
        uint8 maxOperationsPerInterval; // number of transactions permitted per OTP interval. Each transaction shall have a unique nonce. The nonce is auto-incremented within each interval
    }

    struct AuthParams {
        bytes32[] neighbors;
        uint32 indexWithNonce;
        bytes32 eotp;
    }

    struct OperationParams {
        Enums.OperationType operationType;
        Enums.TokenType tokenType;
        address contractAddress;
        uint256 tokenId;
        address payable dest;
        uint256 amount;
        bytes data;
    }

    struct InitParams {
        CoreSetting core; // the most recent core (root, time, etc.) to validate EOTPs against, for normal operations of the wallet
        SpendingManager.SpendingState spendingState;
        address payable recoveryAddress; // an address where funds should go to, when the user triggers recovery. The `recoveryAddress` may send 1.0 ONE to the 1wallet address to trigger auto-recovery, provided that the wallet has been inactive (that no operation has been performed by the user) for 14 days. Merely receiving funds does not make an inactive wallet become active.
        IONEWallet[] backlinkAddresses;
        CoreSetting[] oldCores; // for cores used previously to validate EOTPs. They are inserted by "displaceCore" method. In this method, a new core is assigned to `core`, and the old core is inserted here in `oldCores`. Each core in `oldCore` provides the same level of authorization compared to the current core. Essentially, each oldCore can be considered as authorizing a new authenticator account (where it could be the same compared to an old authenticator account, and the differences in root hash only arises from differences in start time and duration of the OTP Merkle Tree).
        CoreSetting[] innerCores; // for validating an EOTP constructed from N-consecutive OTPs against recovery roots. Since there are N possible offsets, for N consecutive OTPs, we need N roots as well. Therefore, the interval of each innerCore is N times the interval of core or oldCores (assuming they have the same interval, which is 30 seconds by default)
        bytes[] identificationKeys; // 64 bytes each. ECDSA secp256k1 uncompressed public key of the 32-byte seed (as private key) with leading byte (0x04) removed; Since identificationKeys can be computed instantly as soon as we have the seed, we know the wallet address instantly and we can store the full address in the Google Authenticator entry. Contracts can also use identificationKeys[0] to verify the integrity of the code on the contract, therefore identifying whether a contract is legit ONEWallet or not. In the future we may allow some operations authorized by signatures produced from the seed when OTP becomes no longer available, such as renewing the wallet after the wallet is already expired.
    }

    event TransferError(address dest, bytes error);
    event LastResortAddressNotSet();
    event RecoveryAddressUpdated(address dest);
    event PaymentReceived(uint256 amount, address from);
    event PaymentSent(uint256 amount, address dest);
    event PaymentForwarded(uint256 amount, address dest);
    event AutoRecoveryTriggered(address from);
    event AutoRecoveryTriggeredPrematurely(address from, uint256 requiredTime);
    event RecoveryFailure();
    event RecoveryTriggered();
    event Retired();
    event ForwardedBalance(bool success);
    event ForwardAddressUpdated(address dest);
    event ForwardAddressAlreadySet(address dest);
    event ForwardAddressInvalid(address dest);
    event ExternalCallCompleted(address contractAddress, uint256 amount, bytes data, bytes ret);
    event ExternalCallFailed(address contractAddress, uint256 amount, bytes data, bytes ret);


    function identificationKey() external view returns (bytes memory);
    function getIdentificationKeys() external view returns (bytes[] memory);

    function initialize(InitParams memory initParams) external;

    function getForwardAddress() external view returns (address payable);

    function retire() external returns (bool);

    // To be deprecated. Use public fields.
    function getInfo() external view returns (bytes32, uint8, uint8, uint32, uint32, uint8, address, uint256);

    function getOldInfos() external view returns (CoreSetting[] memory);

    // returns the first root assigned to this contract
    function getRootKey() external view returns (bytes32);

    function getVersion() external pure returns (uint32, uint32);

    // DEPRECATED
    function getCurrentSpending() external view returns (uint256, uint256);

    // DEPRECATED
    function getCurrentSpendingState() external view returns (uint256, uint256, uint32, uint32);

    function getSpendingState() external view returns (SpendingManager.SpendingState memory);

    function getNonce() external view returns (uint8);

    function lastOperationTime() external view returns (uint256);

    /// DEPRECATED
    function getCommits() external pure returns (bytes32[] memory, bytes32[] memory, uint32[] memory, bool[] memory);

    function getAllCommits() external view returns (bytes32[] memory, bytes32[] memory, bytes32[] memory, uint32[] memory, bool[] memory);

    /// DEPRECATED
    function findCommit(bytes32 /*hash*/) external pure returns (bytes32, bytes32, uint32, bool);

    function lookupCommit(bytes32 hash) external view returns (bytes32[] memory, bytes32[] memory, bytes32[] memory, uint32[] memory, bool[] memory);

    function commit(bytes32 hash, bytes32 paramsHash, bytes32 verificationHash) external;

    // deprecated since v14
    function reveal(bytes32[] calldata neighbors, uint32 indexWithNonce, bytes32 eotp, Enums.OperationType operationType, Enums.TokenType tokenType, address contractAddress, uint256 tokenId, address payable dest, uint256 amount, bytes calldata data) external;

    function reveal(AuthParams calldata auth, OperationParams calldata op) external;

    function getTrackedTokens() external view returns (Enums.TokenType[] memory, address[] memory, uint256[] memory);

    function getBalance(Enums.TokenType tokenType, address contractAddress, uint256 tokenId) external view returns (uint256);

    function getBacklinks() external view returns (IONEWallet[] memory);

    /// https://eips.ethereum.org/EIPS/eip-1271
    function isValidSignature(bytes32 hash, bytes memory signature) external view returns (bytes4);

    function listSignatures(uint32 start, uint32 end) external view returns (bytes32[] memory, bytes32[] memory, uint32[] memory, uint32[] memory);

    function lookupSignature(bytes32 hash) external view returns (bytes32, uint32, uint32);
}
