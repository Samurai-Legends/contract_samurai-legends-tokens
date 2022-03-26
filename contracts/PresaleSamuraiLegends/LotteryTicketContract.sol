pragma solidity ^0.8.4;

// SPDX-License-Identifier: UNLICENSED

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Burnable.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract LotteryTicketContract is ERC1155, Ownable, Pausable, ERC1155Burnable, ERC1155Supply {
    
    modifier onlyMinter {   

        require(minter[msg.sender] == true || owner() == msg.sender);
        _;
    }

    mapping(address => bool) public minter;
    address[] public lotteryRegistrations;
    bool public lotteryRegistrationActive;
    address[] public lastWinners;
    address[] public rewardWaitingWinners;
    uint public randomizer;

    constructor(string memory _tokenUri) ERC1155("ELVN Game Parts") {
        setURI(_tokenUri);
    }

    function setURI(string memory newuri) public onlyOwner {
        _setURI(newuri);
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }

    function mint(address account, uint256 id, uint256 amount, bytes memory data)
        public
        onlyMinter
    {
        _mint(account, id, amount, data);
    }

    function mintBatch(address to, uint256[] memory ids, uint256[] memory amounts, bytes memory data)
        public
        onlyMinter
    {
        _mintBatch(to, ids, amounts, data);
    }

    function _beforeTokenTransfer(address operator, address from, address to, uint256[] memory ids, uint256[] memory amounts, bytes memory data)
        internal
        whenNotPaused
        override(ERC1155, ERC1155Supply)
    {
        super._beforeTokenTransfer(operator, from, to, ids, amounts, data);
    }

    function random(uint _modulo) internal view returns (uint256) {
        uint256 randomHash = uint256(
            keccak256(
                abi.encodePacked(
                    blockhash(block.number - 1),
                    block.difficulty,
                    block.timestamp,
                    msg.sender,
                    randomizer
                )
            )
        );
        return (randomHash % _modulo) ;
    }

   function setMinter(address _address) public onlyOwner{
        minter[_address] = true;
    }

    function deleteMinter(address _address) public onlyOwner{
        minter[_address] = false;
    }

    function transferFrom(address _from, address _to, uint _id, uint _amount, bytes memory _data) public{
        _safeTransferFrom(_from, _to, _id, _amount, _data);
    }

    function registerForLottery() public {
        require(balanceOf(msg.sender,1) >= 1,"Lottery Contract: You don't have any lottery Tickets");
        require(lotteryRegistrationActive,"Lottery Contract: Lottery Registration is not active");
        burn(msg.sender,1,1);
        lotteryRegistrations.push(msg.sender);
    }

    function stopLotteryRegistration() public onlyOwner{
        require(lotteryRegistrationActive,"Lottery Contract: Registration is already stopped");
        lotteryRegistrationActive = false;
    }

    function resumeLotteryRegistration() public onlyOwner{
        require(!lotteryRegistrationActive,"Lottery Contract: Registration is already active");
        lotteryRegistrationActive = true;
    }

    function pickWinner(uint _winnerCount) public onlyOwner{
        require(!lotteryRegistrationActive, "Lottery Contract: Registration is still active, please stop it first");
        delete lastWinners;
        for(uint i=0; i < _winnerCount; i++){
            uint _randomIndex = random(lotteryRegistrations.length);
            randomizer = _randomIndex;
            lastWinners.push(lotteryRegistrations[_randomIndex]);
            rewardWaitingWinners.push(lotteryRegistrations[_randomIndex]);
        }
    }

    function rewardWinners() public onlyOwner{
        for(uint i=0; i < rewardWaitingWinners.length;i++){
            //REWARD FUNCTION
        }
        delete rewardWaitingWinners;
    }
}