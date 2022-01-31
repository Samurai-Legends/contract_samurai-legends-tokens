// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./Generatable.sol";
import "./Recoverable.sol";
import "./Onceable.sol";
import "./Array.sol";


struct Unlock {
    uint32 createdAt;
    uint112 vestedAmount;
    uint112 claimedAmount;
}

interface IMigration {
    function rsunDepositedTotal() external view returns (uint);
    function infDepositedTotal() external view returns (uint);
    function rsunBalances(address) external view returns (uint);
    function infBalances(address) external view returns (uint);
}

/**
 * @title Contract that adds SMG withdrawing functionalities.
 * @author Leo
 */
contract SamuraiLegendsWithdrawing is Ownable, Generatable, Recoverable {
    using Array for uint[];

    IERC20 immutable private smg;
    IMigration immutable private migration;

    mapping(address => uint) public userUnlockBalance;
    mapping(address => uint[]) public ids;
    mapping(address => mapping(uint => Unlock)) public unlocks;

    int112 private _toDeposit;
    uint112 public totalUnlockBalance;
    uint32 public vestingPeriod = 30 days;

    constructor(IERC20 _smg, IMigration _migration) {
        smg = _smg;
        migration = _migration;
    }

    /**
     * @notice Computes SMG tokens to be deposited by an Admin.
     * @return toDeposit Amount of SMG tokens to be deposited by an Admin.
     */
    function toDeposit() external view returns (int) {
        return int((getSMG(migration.rsunDepositedTotal(), migration.infDepositedTotal()) * 10) / 100) + _toDeposit - int(smg.balanceOf(address(this)));
    }

    /**
     * @notice Computes SMG balance from the migrated RSUN of a user.
     * Current ratio is: 1 SMG = 100 RSUN.
     * @return smgAmount Amount of SMG computed from RSUN.
     */
    function getSMGFromRSUN(uint amount) internal pure returns (uint) {
        return (amount * 10) / 1000;
    }

    /**
     * @notice Computes SMG balance from the migrated INF of a user.
     * Current ratio is: 1 SMG = 12.5 INF.
     * @return smgAmount Amount of SMG computed from INF.
     */
    function getSMGFromINF(uint amount) internal pure returns (uint) {
        return (amount * 10) / 125;
    }

    /**
     * @notice Computes the sum of SMG from rsun and inf amounts.
     * @param rsunAmount Amount of RSUN to convert to SMG.
     * @param infAmount Amount of INF to convert to SMG.
     * @return smgAmount Amount of SMG computed from RSUN and INF.
     */
    function getSMG(uint rsunAmount, uint infAmount) internal pure returns (uint) {
        return getSMGFromRSUN(rsunAmount) + getSMGFromINF(infAmount);
    }

    /**
     * @notice Creates a new unlock from current rsunBalances and infBalances of a user.
     * The user will get 10% and 90% linearly vested for 30 days for every new unlock.
     */
    function unlock() external {
        uint112 amount = uint112(getSMG(migration.rsunBalances(msg.sender), migration.infBalances(msg.sender)) - userUnlockBalance[msg.sender]);
        require(amount != 0, "No amount to unlock.");

        uint claimableAmount = (amount * 10) / 100;
        uint vestedAmount = amount - claimableAmount;

        Unlock memory userUnlock = Unlock({
            createdAt: uint32(block.timestamp),
            vestedAmount: uint112(vestedAmount),
            claimedAmount: 0
        });

        uint id = unique();
        ids[msg.sender].push(id);
        unlocks[msg.sender][id] = userUnlock;

        /**
         * @notice Updates user and total unlock balances trackers.
         */
        userUnlockBalance[msg.sender] += amount;
        totalUnlockBalance += uint104(amount);

        _toDeposit -= int112(uint112(claimableAmount));
        _toDeposit += int112(uint112(vestedAmount));

        require(smg.transfer(msg.sender, claimableAmount), "Transfer failed.");
        
        emit UnlockCreated(msg.sender, amount, block.timestamp);
    }

    /**
     * @notice Computes the passed period and claimable amount of a user unlock object.
     * @param userUnlock User unlock object to get metadata from.
     * @return passedPeriod Passed vesting period of an unlock object.
     * @return claimableAmount Claimable amount of an unlock object.
     */
    function getClaimableAmount(Unlock memory userUnlock) public view returns (uint, uint) {
        uint passedPeriod = min(block.timestamp - userUnlock.createdAt, vestingPeriod);
        uint claimableAmount = (passedPeriod * userUnlock.vestedAmount) / vestingPeriod - userUnlock.claimedAmount;

        return (passedPeriod, claimableAmount);
    }

    /**
     * @notice Lets a user claim an amount according to the linear vesting.
     * @param index Unlock index to withdraw from.
     */
    function claim(uint index) external {
        uint id = ids[msg.sender][index];
        Unlock storage userUnlock = unlocks[msg.sender][id];

        (uint passedPeriod, uint claimableAmount) = getClaimableAmount(userUnlock);

        /**
         * @notice Does a full withdraw since vesting period already finished.
         */
        if (passedPeriod == vestingPeriod) {
            ids[msg.sender].remove(index);
            delete unlocks[msg.sender][id];

            emit UnlockFinished(msg.sender, claimableAmount, block.timestamp);
        } 
        /**
         * @notice Does a partial withdraw since vesting period didn't finish yet.
         */
        else {
            userUnlock.claimedAmount += uint112(claimableAmount);

            emit UnlockUpdated(msg.sender, claimableAmount, block.timestamp);
        }

        _toDeposit -= int112(uint112(claimableAmount));

        require(smg.transfer(msg.sender, claimableAmount), "Transfer failed.");

        emit Claimed(msg.sender, claimableAmount);
    }

    /**
     * @dev Returns the smallest of two unsigned numbers.
     */
    function min(uint a, uint b) internal pure returns (uint) {
        return a < b ? a : b;
    }

    event UnlockCreated(address indexed sender, uint fullAmount, uint createdAt);
    event UnlockUpdated(address indexed sender, uint claimedAmount, uint updatedAt);
    event UnlockFinished(address indexed sender, uint claimedAmount, uint finishedAt);
    event Claimed(address indexed sender, uint amount);
}