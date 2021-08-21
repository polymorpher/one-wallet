// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.4;

enum OperationType {
    TRACK, UNTRACK, TRANSFER_TOKEN, OVERRIDE_TRACK, TRANSFER, SET_RECOVERY_ADDRESS, RECOVER,
    REPLACE, // reserved, not implemented yet. This is for replacing the root and set up new parameters (t0, lifespan)
    FORWARD, // This is for forwarding this contract to another contract and submitting all control to that control (daily limit would still be in effect)
    RECOVER_SELECTED_TOKENS,
    BUY_DOMAIN,
    COMMAND, // command a backlinked wallet to perform an operation
    BACKLINK_ADD, // backlink a 1wallet
    BACKLINK_DELETE, // remove backlink of a backlinked 1wallet
    BACKLINK_OVERRIDE // override the list of backlinked 1wallet
}
enum TokenType{
    ERC20, ERC721, ERC1155, NONE
}
