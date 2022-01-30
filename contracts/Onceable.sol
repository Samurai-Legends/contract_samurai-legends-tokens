// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
@title Onceable
@author Leo
@notice Makes functions get called only once.
*/
contract Onceable {
    mapping(address => bool) internal alreadyCalled;

    modifier onlyOnce {
        require(alreadyCalled[msg.sender] == false, "This function is already called.");
        alreadyCalled[msg.sender] = true;
        _;
    }
}