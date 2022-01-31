// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
@title Contract that can be used to create new tokens.
@author Leo
*/
contract TokenCreator is ERC20 {
    constructor(string memory _name, string memory _symbol, uint _totalSupply) ERC20(_name, _symbol) {
        _mint(msg.sender, _totalSupply * 1e9);
    }

    function decimals() public view virtual override returns (uint8) {
        return 9;
    }
}