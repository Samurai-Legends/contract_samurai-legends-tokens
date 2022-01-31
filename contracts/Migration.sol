//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Migration {
    uint128 public rsunDepositedTotal;
    uint128 public infDepositedTotal;

    mapping(address => uint) public rsunBalances;
    mapping(address => uint) public infBalances;

    function depositRSUN(uint amount) external {
        rsunBalances[msg.sender] += amount;
        rsunDepositedTotal += uint128(amount);

        emit DepositedRSUN(msg.sender, amount);
    }

    function depositINF(uint amount) external {
        infBalances[msg.sender] += amount;
        infDepositedTotal += uint128(amount);

        emit DepositedINF(msg.sender, amount);
    }

    event DepositedRSUN(address indexed user, uint amount);
    event DepositedINF(address indexed user, uint amount);
}