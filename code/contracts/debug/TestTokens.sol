// SPDX-License-Identifier: Apache-2.0
pragma solidity >=0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

contract TestERC20 is ERC20 {
    string constant NAME = "Test20";
    string constant SYMBOL = "T20";
    address admin;
    constructor(uint256 _amount)
    ERC20(NAME, SYMBOL) {
        admin = msg.sender;
        _mint(msg.sender, _amount);
    }
    modifier isAdmin(){
        require(msg.sender == admin, "Only admin can do this");
        _;
    }
    function mint(address dest, uint256 amount) public isAdmin() {
        ERC20._mint(dest, amount);
    }

    function burn(address dest, uint256 amount) public isAdmin() {
        ERC20._burn(dest, amount);
    }
}

contract TestERC721 is ERC721 {
    string constant NAME = "Test721";
    string constant SYMBOL = "T721";
    address admin;
    mapping(uint256 => string) uris;

    constructor(uint256[] memory tokenIds, string[] memory uris_)
    ERC721(NAME, SYMBOL) {
        admin = msg.sender;
        for (uint32 i = 0; i < tokenIds.length; i++) {
            ERC721._mint(msg.sender, tokenIds[i]);
            uris[tokenIds[i]] = uris_[i];
        }

    }
    modifier isAdmin(){
        require(msg.sender == admin, "Only admin can do this");
        _;
    }
    function mint(address dest, uint256 tokenId) external isAdmin() {
        ERC721._mint(dest, tokenId);
    }

    function burn(uint256 tokenId) external isAdmin() {
        ERC721._burn(tokenId);
    }

    function setTokenUri(uint256 tokenId, string memory uri) external isAdmin() {
        uris[tokenId] = uri;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory){
        return uris[tokenId];
    }
}

contract TestERC1155 is ERC1155 {
    address admin;
    mapping(uint256 => string) metadataUris;
    constructor(uint256[] memory tokenIds, uint256[] memory amounts, string[] memory uris_)
    ERC1155("") {
        admin = msg.sender;
        for (uint32 i = 0; i < tokenIds.length; i++) {
            ERC1155._mint(msg.sender, tokenIds[i], amounts[i], "");
            metadataUris[tokenIds[i]] = uris_[i];
        }
    }
    modifier isAdmin(){
        require(msg.sender == admin, "Only admin can do this");
        _;
    }
    function mint(uint256 tokenId, uint256 amount, address dest, string memory metadataUri) public isAdmin() {
        ERC1155._mint(dest, tokenId, amount, "");
        metadataUris[tokenId] = metadataUri;
    }

    function setUri(uint256 id, string memory uri_) public isAdmin() {
        metadataUris[id] = uri_;
    }

    function uri(uint256 id) override public view returns (string memory){
        return metadataUris[id];
    }

    function burn(address dest, uint256 tokenId, uint256 amount) public isAdmin() {
        ERC1155._burn(dest, tokenId, amount);
    }
}
