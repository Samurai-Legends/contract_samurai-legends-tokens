// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

//      .....................................................                      
//     . ...........................................................               
// .....................................................................           
// ................................................,.,.................... ....    
// ......................................./%(...,,,,,,,,......................     
// .....................................&%&&%&@.,,,,,,,,.....................      
// ............................,,....(%@&&&%%@@%&/,,,,......................... .  
// ........................,,,,..,.@#@@@#&...%@@@%&@...........................    
// ................,.....,,,,,,,(&@@@&& .,,,,,, &%%%%&(............................
// ...............,,.,.,,,,,,.@%@@@&&.,,,,&%&,,,,.#&%&@@@..........................
// .............,,,,,,,,,,,(&&&@@@ ,,,,.&#&&@#&,.... @@@@&&/.......................
// .........,....,,.,,,,,@@@@@@%.,,,,&%&&&&&&&&@%&.,,..#@@&&@@.....................
// ...........,,,,,,,,/@@@@@@ ,,,,.&%%%&&&&&&&&&&@%&,,,.. &&&&&&(,.,,..............
// ...........,,,,,.@@@@@@#.,,,,%&&%%%%%%%&&&&&&&&&&&&&,,,..#@&&&@@................
// ..........,,,,/@@@@@@ ,,,,,@&&&&&&%&&&%&&&&&&&&&&&&&%&,,,,. @@@@@@/.............
// ............@@@@@@#.,,,,%&@&&&&&&&&&@&&& &&&&&&&&&&&&&&&&,,,,.#@@@@@@ ..........
// ......... @@@@@@(,,,,,@&&&&&&&&&&&&@&(.,,,./&@&&&&&&&&@@&&&.,,,.(@@@@@@ ........
// ............&@@@@@@.,,,,.&@&&&&@&&& ,,,,,,,,, @&&@&&&&@&/.,,,.@@@@@@& ..........
// .........,,,,, @@@@@@(,,,,.@@&@@/.,,,,&@@&&,,,,,/@@@&&.,,,,(@@@@@@ .............
// ..........,,,,,,.&@@@@@@.,,,.. ,,,,,@&@@@@@@@*,,,, *.,,,.@@@@@@&................
// ........,,.,,,,,,,, @@@@@@(,,,,,,&&&&&&&&&&&&@&&,,,,,,(@@@@@@ ..................
// ........,,,,,,,,,,,,,.&@@@@@@.,,,..&@&&&&&&&@@,,,,..@@@@@@&.....................
// ........,,,,,,,,,,,,,,,, @@@@@@(.,,. @&&@&&@.,,,./@@@@@@ .......................
// .........,,,,,,,,,,,,,,,,,.&@@@@@@.,....&,,,,,.@@@@@@%..........................
// ..........,,,,,,,,,,,,,,,,,,. @@@@@@(.,,,,,,*@@@@@@ ............................
// .......,...,,,,,,,,,,,,,,,,,....&@@@@@@.,.@@@@@@%...............................
// ...........,,,,,,,,,,,,,,,,,...... &&@@@@@@&@& .................................
// .................,,,,,,,,,,....,...,.&@@@@@&....................................
// .....................,.,,,,........,,,, @ ....................................  
// ..................................,,,,.......................................   
// ..................................,,.,.....................................     
// .........................................................................   

// authors: Leo, David

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./Generator.sol";
import "./Array.sol";

contract SamuraiLegendsStaking is Ownable, Pausable, Generator {
    using Array for uint[];

    IERC20 private immutable _smg;

    uint public rewardRate;
    uint public rewardDuration = 60 seconds;
    uint private _rewardUpdatedAt = block.timestamp;
    uint private _rewardFinishedAt;

    uint private _totalStake;
    mapping(address => uint) private _userStake;
    
    uint private _rewardPerToken;
    uint private _lastRewardPerTokenPaid;
    mapping(address => uint) private _userRewardPerTokenPaid;

    struct PendingAmount {
        uint createdAt;
        uint fullAmount;
        uint claimedAmount;
    }    


    uint constant public pendingPeriod = 120 seconds;
    mapping(address => uint[]) private _userPendingIds;
    mapping(address => mapping(uint => PendingAmount)) private _userPending;

    constructor(IERC20 token) {
        _smg = token;
    }

    function totalStake() public view returns (uint) {
        return _totalStake + _earned(_totalStake, _lastRewardPerTokenPaid);
    }

    function userStake(address account) public view returns (uint) {
        return _userStake[account] + earned(account);
    }

    function userPending(address account, uint index) public view returns (PendingAmount memory) {
        uint id = _userPendingIds[account][index];
        return _userPending[account][id];
    }

    function userClaimablePendingPercentage(address account, uint index) public view returns (uint) {
        uint n = getClaimablePendingPortion(userPending(account, index).createdAt);
        return n >= 4 ? 100 : n * 25;
    }

    function userPendingIds(address account) public view returns (uint[] memory) {
        return _userPendingIds[account];
    }

    function lastTimeRewardActiveAt() public view returns (uint) {
        return _rewardFinishedAt > block.timestamp ? block.timestamp : _rewardFinishedAt;
    }

    function rewardPerToken() internal view returns (uint) {
        if (_totalStake == 0) {
            return _rewardPerToken;
        }

        return _rewardPerToken + ((lastTimeRewardActiveAt() - _rewardUpdatedAt) * rewardRate * 1e18) / _totalStake;
    }

    function totalDurationReward() public view returns (uint) {
        return rewardRate * rewardDuration;
    }

    function earned(address account) private view returns (uint) {
        return _earned(_userStake[account], _userRewardPerTokenPaid[account]);
    }

    function _earned(uint stakeAmount, uint rewardPerTokenPaid) internal view returns (uint) {
        uint rewardPerTokenDiff = rewardPerToken() - rewardPerTokenPaid;
        return (stakeAmount * rewardPerTokenDiff) / 1e18;
    }

    modifier updateReward(address account) {
        _rewardPerToken = rewardPerToken();
        _rewardUpdatedAt = lastTimeRewardActiveAt();
        
        // auto-compounding
        if (account != address(0)) {
            uint reward = earned(account);

            _userRewardPerTokenPaid[account] = _rewardPerToken;
            _lastRewardPerTokenPaid = _rewardPerToken;

            _userStake[account] += reward;
            _totalStake += reward;
        }
        _;
    }

    function stake(uint amount) external whenNotPaused updateReward(msg.sender) {
        // checks
        require(amount > 0, "Invalid input amount.");

        // effects
        _totalStake += amount;
        _userStake[msg.sender] += amount;

        // interactions
        require(_smg.transferFrom(msg.sender, address(this), amount), "Transfer failed.");

        emit Staked(msg.sender, amount);
    }


    function createPending(uint amount) internal {
        uint id = unique();
        _userPendingIds[msg.sender].push(id);
        _userPending[msg.sender][id] = PendingAmount({  
            createdAt: block.timestamp, 
            fullAmount: amount, 
            claimedAmount: 0
        });

        emit PendingCreated(msg.sender, block.timestamp, amount);
    }

    function withdraw(uint amount) external updateReward(msg.sender) {
        // checks
        require(_userStake[msg.sender] > 0, "User have no active stake.");
        require(amount > 0 && _userStake[msg.sender] >= amount, "Invalid input amount.");


        // effects
        _totalStake -= amount;
        _userStake[msg.sender] -= amount;

        createPending(amount);

        emit Withdrawn(msg.sender, amount);
    }

    function withdrawAll() external updateReward(msg.sender) {
        // checks
        uint amount = _userStake[msg.sender];

        // effects
        _totalStake -= amount;
        _userStake[msg.sender] -= amount;

        createPending(amount);

        emit Withdrawn(msg.sender, amount);
    }

    function getClaimablePendingPortion(uint createdAt) internal view returns (uint) {
        return (((block.timestamp - createdAt) * 100) / pendingPeriod) / 25; // 0 1 2 3 4
    }

    function claim(uint index) external {
        // checks
        uint id = _userPendingIds[msg.sender][index];
        PendingAmount storage pendingAmount = _userPending[msg.sender][id];

        // Get available claim
        uint n = getClaimablePendingPortion(pendingAmount.createdAt);
        require(n != 0, "Claim is still pending.");

        uint amount;
        if (n >= 4) {
            amount = pendingAmount.fullAmount - pendingAmount.claimedAmount;
        } else {
            amount = (pendingAmount.fullAmount * n * 25 * 1e16) / 1e18 - pendingAmount.claimedAmount;
        }

        require(amount != 0, "Claim is still pending.");
        
        // effects
        if (n >= 4) { // Pending is completely done | Remove Pending
            _userPendingIds[msg.sender].remove(index);
            delete _userPending[msg.sender][id];
            emit PendingFinished(msg.sender, pendingAmount.createdAt, pendingAmount.fullAmount);
        } else { // Pending is partially done | Update Pending
            pendingAmount.claimedAmount += amount;
            emit PendingUpdated(msg.sender, pendingAmount.createdAt, pendingAmount.fullAmount);
        }
        
        // interactions
        require(_smg.transfer(msg.sender, amount), "Transfer failed.");

        emit Claimed(msg.sender, amount);
    }

    function addReward(uint _reward) external onlyOwner updateReward(address(0)) {
        require(_reward > 0, "Invalid input.");

        if (block.timestamp > _rewardFinishedAt) { // Reward duration finished
            rewardRate = _reward / rewardDuration;
        } else {
            uint remainingReward = rewardRate * (_rewardFinishedAt - block.timestamp);
            rewardRate = (remainingReward + _reward) / rewardDuration;
        }

        _rewardUpdatedAt = block.timestamp;
        _rewardFinishedAt = block.timestamp + rewardDuration;

        require(_smg.transferFrom(owner(), address(this), _reward), "Transfer failed.");

        emit RewardAdded(_reward);
    }

    function updateRewardDuration(uint _rewardDuration) external onlyOwner {
        require(block.timestamp > _rewardFinishedAt, "Reward duration must be finalized.");

        rewardDuration = _rewardDuration;

        emit RewardDurationUpdated(_rewardDuration);
    }

    function pause() external whenNotPaused onlyOwner {
        _pause();
    }

    function unpause() external whenPaused onlyOwner {
        _unpause();
    }

    event Staked(address indexed account, uint amount);
    event PendingCreated(address indexed account, uint createdAt, uint amount);
    event PendingUpdated(address indexed account, uint createdAt, uint amount);
    event PendingFinished(address indexed account, uint createdAt, uint amount);
    event Withdrawn(address indexed account, uint amount);
    event Claimed(address indexed account, uint amount);
    event RewardAdded(uint amount);
    event RewardDurationUpdated(uint duration);
}