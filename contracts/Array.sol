// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;


library Array {
    function remove(uint[] storage array, uint index) internal {
        require(index < array.length);
        array[index] = array[array.length - 1];
        array.pop();
    }
}