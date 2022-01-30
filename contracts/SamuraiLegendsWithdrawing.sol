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
    uint112 fullAmount;
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
contract SamuraiLegendsWithdrawing is Ownable, Generatable, Recoverable, Onceable {
    using Array for uint[];

    IERC20 immutable private smg;
    IMigration immutable private migration;

    mapping(address => uint) public userUnlockBalance;
    mapping(address => uint[]) public ids;
    mapping(address => mapping(uint => Unlock)) public unlocks;

    uint104 public totalUnlockBalance;
    uint104 public totalUnlockBalancePostLaunch;
    uint40 public vestingPeriod = 30 days;
    bool public launched = false;

    constructor(IERC20 _smg, IMigration _migration) {
        smg = _smg;
        migration = _migration;
    }

    /**
     * @notice Computes SMG tokens to be deposited by an Admin.
     */
    function toDeposit() external view returns (uint) {
        if (launched) {
            int diff = int104(totalUnlockBalancePostLaunch) - int(smg.balanceOf(address(this)));
            return uint(max(diff, 0));
        }

        return (getSMG(migration.rsunDepositedTotal(), migration.infDepositedTotal()) * 10) / 100; // 10%
    }

    /**
     * @notice Computes SMG balance from the migrated RSUN of a user.
     * Current ratio is: 1 SMG = 100 RSUN.
     */
    function getSMGFromRSUN(uint amount) internal pure returns (uint) {
        return (amount * 10) / 1000;
    }

    /**
     * @notice Computes SMG balance from the migrated INF of a user.
     * Current ratio is: 1 SMG = 12.5 INF.
     */
    function getSMGFromINF(uint amount) internal pure returns (uint) {
        return (amount * 10) / 125;
    }

    /**
     * @notice Computes the sum of SMG from rsun and inf amounts.
     * @param rsunAmount Amount of RSUN to convert to SMG.
     * @param infAmount Amount of INF to convert to SMG.
     */
    function getSMG(uint rsunAmount, uint infAmount) internal pure returns (uint) {
        return getSMGFromRSUN(rsunAmount) + getSMGFromINF(infAmount);
    }

    /**
     * @notice Creates a new unlock from current rsunBalances and infBalances of a user.
     * The unlock function will only be active after launch.
     */
    function unlock() external launchState(true) {
        uint112 amount = uint112(getSMG(migration.rsunBalances(msg.sender), migration.infBalances(msg.sender)) - userUnlockBalance[msg.sender]);
        require(amount != 0, "No amount to unlock.");

        Unlock memory userUnlock = Unlock({
            createdAt: uint32(block.timestamp),
            fullAmount: amount,
            claimedAmount: 0
        });

        uint id = unique();
        ids[msg.sender].push(id);
        unlocks[msg.sender][id] = userUnlock;

        /**
         * @notice Updates user and total unlock balances trackers.
         */
        userUnlockBalance[msg.sender] += userUnlock.fullAmount;
        totalUnlockBalance += uint104(userUnlock.fullAmount);
        totalUnlockBalancePostLaunch += uint104(userUnlock.fullAmount);
        
        emit UnlockCreated(msg.sender, userUnlock.fullAmount, userUnlock.createdAt);
    }

    /**
     * @notice Lets a user withdraw 10% of current holdings with no linear vesting.
     * It will only be active before launch.
     * It will only be able to be called once per user.
     */
    function beforeLaunchWithdraw() external launchState(false) onlyOnce {
        uint fullAmount = getSMG(migration.rsunBalances(msg.sender), migration.infBalances(msg.sender));
        require(fullAmount != 0, "No amount to withdraw.");

        uint amount = (fullAmount * 10) / 100; // 10%
        
        /**
         * @notice Updates user and total unlock balances trackers.
         */
        userUnlockBalance[msg.sender] += amount;
        totalUnlockBalance += uint104(amount);

        require(smg.transfer(msg.sender, amount), "Transfer failed.");

        emit Withdrawn(msg.sender, amount);
    }

    /**
     * @notice Computes the passed period and claimable amount of a user unlock object.
     * @param userUnlock User unlock object to get metadata from.
     */
    function getClaimableAmount(Unlock memory userUnlock) public view returns (uint, uint) {
        uint passedPeriod = min(block.timestamp - userUnlock.createdAt, vestingPeriod);
        uint claimableAmount = (passedPeriod * userUnlock.fullAmount) / vestingPeriod - userUnlock.claimedAmount;

        return (passedPeriod, claimableAmount);
    }

    /**
     * @notice Lets a user withdraw an amount according to the linear vesting.
     * @param index Unlock index to withdraw from.
     */
    function withdraw(uint index) external launchState(true) {
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

        require(smg.transfer(msg.sender, claimableAmount), "Transfer failed.");

        emit Withdrawn(msg.sender, claimableAmount);
    }

    /**
     * @notice Gives the owner the ability to set the launch state to true.
     */
    function launch() external onlyOwner {
        launched = true;
        emit Launched(block.timestamp);
    }

    /**
     * @dev Returns the largest of two signed numbers.
     */
    function max(int a, int b) internal pure returns (int) {
        return a > b ? a : b;
    }

    /**
     * @dev Returns the smallest of two unsigned numbers.
     */
    function min(uint a, uint b) internal pure returns (uint) {
        return a < b ? a : b;
    }

    /**
     * @notice Compares the launch state with an expected value.
     * @param expected Expected launch state
     */
    modifier launchState(bool expected) {
        require(launched == expected, "Launched state isn't as expected!");
        _;
    }

    event Launched(uint launchedAt);
    event UnlockCreated(address indexed sender, uint fullAmount, uint createdAt);
    event UnlockUpdated(address indexed sender, uint claimedAmount, uint updatedAt);
    event UnlockFinished(address indexed sender, uint claimedAmount, uint finishedAt);
    event Withdrawn(address indexed sender, uint amount);
}