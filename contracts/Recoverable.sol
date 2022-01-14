// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Recoverable is Ownable {
    address constant private WBNB = 0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c;

    constructor() payable {}

    function recover(address token) external onlyOwner {
        if (token == WBNB) {
            (bool success, ) = payable(owner()).call{value: address(this).balance}("");
            require(success, "Recover failed.");
        } else {
            IERC20 erc20 = IERC20(token);
            require(erc20.transfer(owner(), erc20.balanceOf(address(this))), "Recover failed");
        }
    }
}