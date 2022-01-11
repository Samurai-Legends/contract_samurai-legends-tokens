// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;


contract Generator {
    uint private id;

    function unique() internal returns (uint) {
        id += 1;
        return id;
    }
}