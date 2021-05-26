pragma solidity ^0.7.6;

import "../core/wallet_data.sol";

library Recovery {

    bytes32 public constant START_RECOVERY_TYPEHASH = keccak256(
        "startRecovery(bytes16, uint8, uint, uint)"
    );

    function startRecovery(Core.Wallet storage wallet_, bytes16 rootHash_, uint8 merkelHeight_, uint timePeriod_,
        uint timeOffset_, bytes calldata signatures_) public {

        uint requiredSignatures = ceil(wallet_.guardians.length, 2);
        require(requiredSignatures * 65 == signatures_.length, "Wrong number of signatures");

        bytes32 signHash = getSignHash(rootHash_, merkelHeight_, timePeriod_, timeOffset_);
        require(validateSignatures(wallet_, signHash, signatures_), "Invalid signatures");

        // queue it for next 24hrs
        wallet_.recovery = Core.RecoveryInfo(rootHash_, merkelHeight_, timePeriod_, timeOffset_, block.timestamp + 86400);
    }

    function finalizeRecovery(Core.Wallet storage wallet_) public {
        require(uint64(block.timestamp) > wallet_.recovery.expiration, "ongoing recovery period");

        wallet_.rootHash = wallet_.recovery.rootHash;
        wallet_.merkelHeight = wallet_.recovery.merkelHeight;
        wallet_.timePeriod = wallet_.recovery.timePeriod;
        wallet_.timeOffset = wallet_.recovery.timeOffset;

        wallet_.recovery = Core.RecoveryInfo(0, 0, 0, 0, 0);
    }

    //
    // Private functions
    //

    /**
    * @notice Returns ceil(a / b).
    */
    function ceil(uint256 a, uint256 b) internal pure returns (uint256) {
        uint256 c = a / b;
        if (a % b == 0) {
            return c;
        } else {
            return c + 1;
        }
    }

    function validateSignatures(Core.Wallet storage wallet_, bytes32 _signHash, bytes memory _signatures) internal view returns (bool)
    {
        if (_signatures.length == 0) {
            return true;
        }
        address lastSigner = address(0);
        address[] memory guardians = wallet_.guardians;
        bool isGuardian;

        for (uint256 i = 0; i < _signatures.length / 65; i++) {
            address signer = recoverSigner(_signHash, _signatures, i);

            if (signer <= lastSigner) {
                return false;
                // Signers must be different
            }
            lastSigner = signer;
            isGuardian = isGuardianAddress(guardians, signer);
            if (!isGuardian) {
                return false;
            }
        }
        return true;
    }

    function isGuardianAddress(address[] memory _guardians, address _guardian) internal view returns (bool) {
        for (uint256 i = 0; i < _guardians.length; i++) {
            if (_guardian == _guardians[i]) {
                return true;
            }
        }
        return false;
    }

    function getSignHash(bytes16 rootHash_, uint8 merkelHeight_, uint timePeriod_, uint timeOffset_)
    internal
    view
    returns (bytes32)
    {

        bytes memory encodedData = abi.encode(
            START_RECOVERY_TYPEHASH,
            rootHash_,
            merkelHeight_,
            timePeriod_,
            timeOffset_
        );

        return keccak256(
            abi.encodePacked(
                "\x19Ethereum Signed Message:\n32",
                keccak256(encodedData)
            ));
    }

    function recoverSigner(bytes32 _signedHash, bytes memory _signatures, uint _index) internal pure returns (address) {
        uint8 v;
        bytes32 r;
        bytes32 s;
        // we jump 32 (0x20) as the first slot of bytes contains the length
        // we jump 65 (0x41) per signature
        // for v we load 32 bytes ending with v (the first 31 come from s) then apply a mask
        // solhint-disable-next-line no-inline-assembly
        assembly {
            r := mload(add(_signatures, add(0x20, mul(0x41, _index))))
            s := mload(add(_signatures, add(0x40, mul(0x41, _index))))
            v := and(mload(add(_signatures, add(0x41, mul(0x41, _index)))), 0xff)
        }
        require(v == 27 || v == 28, "Utils: bad v value in signature");

        address recoveredAddress = ecrecover(_signedHash, v, r, s);
        require(recoveredAddress != address(0), "Utils: ecrecover returned 0");
        return recoveredAddress;
    }

}
