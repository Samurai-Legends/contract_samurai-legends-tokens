// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
@title Recoverable
@author Leo
@notice Recovers stucked BNB or ERC20 tokens
@dev You can inhertit from this contract to support recovering stucked tokens or BNB
*/
contract Recoverable is Ownable {
    /**
    @notice Recovers stucked BNB in the contract
    */
    function recoverBNB() external onlyOwner {
        (bool success, ) = payable(owner()).call{value: address(this).balance}("");
        require(success, "Recover failed.");
    }

    /**
    @notice Recovers stucked ERC20 token in the contract
    @param token An ERC20 token address
    */
    function recoverERC20(address token) external onlyOwner {
        IERC20 erc20 = IERC20(token);
        require(erc20.transfer(owner(), erc20.balanceOf(address(this))), "Recover failed");
    }
}