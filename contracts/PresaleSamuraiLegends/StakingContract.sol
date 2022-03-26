

pragma solidity ^0.8.0;

// SPDX-License-Identifier: UNLICENSED
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

interface ISMG is IERC20{
    function usedUnvestedBalance(address _contributor) external view returns(uint);
    function vestingIncome(address _to, uint _amount) external;
    function paymentIncome(address _to, uint _amount) external;
    function setUnvestedBalance(address _to, uint _amount) external;
    function unvestedBalance(address _to) external view returns(uint);
    function totalAvailableBalance(address _owner) external view returns(uint256);
    function unvestedPayment(address _owner, uint _amount) external;
}

interface ILOTTERY is IERC1155{
    function mint(address account, uint256 id, uint256 amount, bytes memory data) external;
}

contract StakingContract is Ownable {
    mapping(address => Staking) public stakedAmount;
    mapping(address => uint) public claimedTickets;
    uint public apyRate;
    uint public withdrawDelay;
    address public tokenAddress;
    uint public lotteryPower;
    address public lotteryTicketAddress;


    struct Staking{
        uint stakingAmount;
        uint stakingTimestamp;
        uint stakingApyRate;
        uint previousSummedStakingPower;
    }

    constructor(address _tokenAddress, uint _apyRate, uint _withdrawDelay, uint _lotteryPower){
        tokenAddress =_tokenAddress;
        apyRate = _apyRate;
        withdrawDelay = _withdrawDelay;
        lotteryPower = _lotteryPower;
    }

    function stakeTokens(uint _amount) public{
        require(ISMG(tokenAddress).totalAvailableBalance(msg.sender) >= _amount,"Staking Contract: You don't have enough balance");
        require(stakedAmount[msg.sender].stakingAmount == 0,"Staking Contract: You already have an active staking");
        ISMG(tokenAddress).unvestedPayment(msg.sender, _amount);
        stakedAmount[msg.sender] = Staking(_amount,block.timestamp,apyRate,0);
    }
    

    function unstakeTokens() public{
        require(block.timestamp - stakedAmount[msg.sender].stakingTimestamp >= withdrawDelay,"Staking Contract: You need to wait for the Withdrawal delay");
        uint _usedUnvestedBalance = ISMG(tokenAddress).usedUnvestedBalance(msg.sender);
        uint _totalAmount = stakedAmount[msg.sender].stakingAmount + getStakingTokenRewards(msg.sender);
        if(_usedUnvestedBalance == 0){
            ISMG(tokenAddress).transfer(msg.sender,_totalAmount);
        }
        else if(_usedUnvestedBalance >= _totalAmount){
            ISMG(tokenAddress).paymentIncome(msg.sender, _totalAmount);
        }
        else{
            ISMG(tokenAddress).paymentIncome(msg.sender, _usedUnvestedBalance);
            ISMG(tokenAddress).transfer(msg.sender,_totalAmount-_usedUnvestedBalance);
        }
        delete stakedAmount[msg.sender];
    }

    function getStakingTokenRewards(address _staker) public view returns(uint){
        uint _passedDays = (block.timestamp - stakedAmount[_staker].stakingTimestamp) / 86400;
        uint _stakingAmount = stakedAmount[_staker].stakingAmount;
        return _stakingAmount * _passedDays * stakedAmount[_staker].stakingApyRate / 365 / 100;
    }

    function getStakingTicketRewards(address _staker) public view returns(uint){
        return getStakingPower(_staker) / lotteryPower;
    }

    function getAvailableStakingTicketRewards(address _staker) public view returns(uint){
        return getStakingTicketRewards(_staker) - claimedTickets[_staker];
    }

    function getStakingPower(address _staker) public view returns(uint){
        uint _passedDays = (block.timestamp - stakedAmount[_staker].stakingTimestamp) / 86400;
        return (stakedAmount[_staker].stakingAmount / 1e18 * _passedDays) + stakedAmount[_staker].previousSummedStakingPower;
    }

    function getLotteryTickets() public{
        uint _availableTickets = getStakingTicketRewards(msg.sender);
        require(_availableTickets >= 1, "Staking Contract: You don't have any Lotter Tickets available");
        ILOTTERY(lotteryTicketAddress).mint(msg.sender,1,_availableTickets,"");
        claimedTickets[msg.sender] = _availableTickets;
    }

    function increaseStaking(uint _amount) public{
        require(ISMG(tokenAddress).totalAvailableBalance(msg.sender) >= _amount,"Staking Contract: You don't have enough balance");
        ISMG(tokenAddress).unvestedPayment(msg.sender, _amount);
        uint _previousAmount = stakedAmount[msg.sender].stakingAmount + getStakingTokenRewards(msg.sender);
        uint _currentStakingPower = getStakingPower(msg.sender);
        stakedAmount[msg.sender] = Staking(_previousAmount + _amount,block.timestamp,apyRate,_currentStakingPower);
    }

    function decreaseStaking(uint _amount) public{
        require(block.timestamp - stakedAmount[msg.sender].stakingTimestamp >= withdrawDelay,"Staking Contract: You need to wait for the Withdrawal delay");
        uint _previousAmount = stakedAmount[msg.sender].stakingAmount + getStakingTokenRewards(msg.sender);
        require(_previousAmount >= _amount,"Staking Contract: You don't have enough balance");

        uint _usedUnvestedBalance = ISMG(tokenAddress).usedUnvestedBalance(msg.sender);
        if(_usedUnvestedBalance == 0){
            ISMG(tokenAddress).transfer(msg.sender,_amount);
        }
        else if(_usedUnvestedBalance >= _amount){
            ISMG(tokenAddress).paymentIncome(msg.sender, _amount);
        }
        else{
            ISMG(tokenAddress).paymentIncome(msg.sender, _usedUnvestedBalance);
            ISMG(tokenAddress).transfer(msg.sender,_amount-_usedUnvestedBalance);
        }
        delete stakedAmount[msg.sender];
        uint _currentStakingPower = getStakingPower(msg.sender);
        stakedAmount[msg.sender] = Staking(_previousAmount - _amount,block.timestamp,apyRate,_currentStakingPower);
    }

    function refreshStaking() public{
        uint _newStakingAmount = stakedAmount[msg.sender].stakingAmount + getStakingTokenRewards(msg.sender);
        uint _currentStakingPower = getStakingPower(msg.sender);
        stakedAmount[msg.sender] = Staking(_newStakingAmount,block.timestamp,apyRate,_currentStakingPower);
    }

    function setApyRate(uint _apyRate) public onlyOwner{
        apyRate = _apyRate;
    }

    function setWithdrawDelay(uint _withdrawDelay) public onlyOwner{
        withdrawDelay = _withdrawDelay;
    }

    function setLotteryPower(uint _lotteryPower) public onlyOwner{
        lotteryPower = _lotteryPower;
    }

    function withdrawTokens(address _tokenAddress) public onlyOwner{
        uint _balance = IERC20(_tokenAddress).balanceOf(address(this));
        require(_balance > 0,"Vesting Contract: There is no balance available for this Token");
        IERC20(_tokenAddress).transfer(msg.sender,_balance);
    }
}
