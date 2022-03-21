// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.4;

library Enums {
    // This list is extended in almost every version. Some of them are now redundant. We should simplify it some time.
    enum OperationType {
        TRACK,
        UNTRACK,
        TRANSFER_TOKEN,
        OVERRIDE_TRACK,
        TRANSFER,
        SET_RECOVERY_ADDRESS,
        RECOVER,
        DISPLACE, // reserved, not implemented yet. This is for replacing the root and set up new parameters (t0, lifespan)
        FORWARD, // This is for forwarding this contract to another contract and submitting all control to that control (daily limit would still be in effect)
        RECOVER_SELECTED_TOKENS,
        BUY_DOMAIN,
        COMMAND, // command a backlinked wallet to perform an operation
        BACKLINK_ADD, // backlink a 1wallet
        BACKLINK_DELETE, // remove backlink of a backlinked 1wallet
        BACKLINK_OVERRIDE, // override the list of backlinked 1wallet
        RENEW_DOMAIN,
        TRANSFER_DOMAIN,
        RECLAIM_REVERSE_DOMAIN,
        RECLAIM_DOMAIN_FROM_BACKLINK,
        SIGN, // produce signature verifiable by eip-1271
        REVOKE, // revoke a signature
        CALL, // call arbitrary external contract function and optionally send funds to that function, or making multiple calls in one go
        BATCH, // execute multiple operations in a single auth
        NOOP, // indicates no operation should be performed. This is useful to store pending ops
        CHANGE_SPENDING_LIMIT, // adjust daily spend limit to a value between [0, 2s] where s is the current spending limit
        JUMP_SPENDING_LIMIT, // adjust daily spend limit to a value between [0, h] where h is the highest spending limit used so far
        DELEGATE, // delegate some native asset to a Harmony validator
        UNDELEGATE, // undelegate some native asset from a Harmony validator
        COLLECT_REWARD, // collect reward accumulated through delegation on Harmony
        CREATE // reserved, for creating new contract
    }
    enum TokenType{
        ERC20, ERC721, ERC1155, NONE
    }
}

