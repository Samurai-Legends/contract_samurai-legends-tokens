//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";


contract LockedTokenContract is IERC20, Ownable {
    using SafeMath for uint256;
    using Address for address;

    mapping(address => uint256) private balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    address[] private _excluded;

    uint256 private constant _totalSupply = 1000000000 * 10**9;

    mapping(address => uint256) public unvestedBalance;
    mapping(address => uint256) public usedUnvestedBalance;
    mapping(address => bool) public paymentContracts;


    mapping(address => bool) public transferBlockList_;
    mapping(address => bool) public approveBlockList_;

    address public originalTokenAddress;

    event PoolFeeSet(uint256 _new);
    event ServiceFeeSet(uint256 _new);
    event MaxTxPercSet(uint256 _new);
    event NumTokensSet(uint256 _new);
    event PoolAddrSet(address indexed _new);
    event ServiceAddrSet(address indexed _new);
    event SetFee(uint16 oldFeePercentage, uint16 newFeePercentage);
    event SetFeeOwner(address indexed oldFeeOwner, address indexed newFeeOwner);
    event SwapToOriginal(address indexed user, uint256 totalAmount);
    event SwapFromOriginal(address indexed user, uint256 amount);
    event AddToTransferBlockList(address indexed addr);
    event RemoveFromTransferBlockList(address indexed addr);
    event AddToApproveBlockList(address indexed addr);
    event RemoveFromApproveBlockList(address indexed addr);

    modifier onlyPaymentContracts() {
        require(paymentContracts[msg.sender] || owner() == msg.sender, "LSMG: You can't call this function!");
        _;
    }

    constructor() {

        balances[_msgSender()] = _totalSupply;

        //exclude owner and this contract from fee

        emit Transfer(address(0), _msgSender(), _totalSupply);
    }

    function name() external pure returns (string memory) {
        return "Locked Samurai Legends Token";
    }

    function symbol() external pure returns (string memory) {
        return "LSMG";
    }

    function decimals() external pure returns (uint8) {
        return 9;
    }

    function totalSupply() external pure override returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) public view override returns (uint256) {
        return balances[account];
    }

    function transfer(address recipient, uint256 amount)
        external
        override
        returns (bool)
    {
        _transfer(_msgSender(), recipient, amount);
        return true;
    }

    function allowance(address owner, address spender)
        external
        view
        override
        returns (uint256)
    {
        return _allowances[owner][spender];
    }

    function approve(address spender, uint256 amount)
        external
        override
        returns (bool)
    {
        _approve(_msgSender(), spender, amount);
        return true;
    }

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) public override returns (bool) {
        _transfer(sender, recipient, amount);
        _approve(
            sender,
            _msgSender(),
            _allowances[sender][_msgSender()].sub(
                amount,
                "ERC20: transfer amount exceeds allowance"
            )
        );
        return true;
    }

    function increaseAllowance(address spender, uint256 addedValue)
        external
        virtual
        returns (bool)
    {
        _approve(
            _msgSender(),
            spender,
            _allowances[_msgSender()][spender].add(addedValue)
        );
        return true;
    }

    function decreaseAllowance(address spender, uint256 subtractedValue)
        external
        virtual
        returns (bool)
    {
        _approve(
            _msgSender(),
            spender,
            _allowances[_msgSender()][spender].sub(
                subtractedValue,
                "ERC20: decreased allowance below zero"
            )
        );
        return true;
    }

    //to receive ETH from uniswapV2Router when swapping
    receive() external payable {}

    function paymentIncome(address _to, uint _amount) public onlyPaymentContracts {
        usedUnvestedBalance[_to] = usedUnvestedBalance[_to].sub(_amount);
    }

    function withdrawTokens(address _tokenAddress, uint _amount) public onlyOwner{
        uint _balance = IERC20(_tokenAddress).balanceOf(address(this));
        require(_balance >= _amount,"Vesting Contract: There is no balance available for this Token");
        IERC20(_tokenAddress).transfer(msg.sender,_amount);
    }

    function _approve(
        address owner,
        address spender,
        uint256 amount
    ) private {
        require(owner != address(0), "ERC20: approve from the zero address");
        require(spender != address(0), "ERC20: approve to the zero address");
        require(isApproveAllowed(spender), "ERC20: approve not allowed");

        _allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

    function _transfer(
        address from,
        address to,
        uint256 amount
    ) private {
        require(from != address(0), "ERC20: transfer from the zero address");
        require(to != address(0), "ERC20: transfer to the zero address");
        require(amount > 0, "Transfer amount must be greater than zero");
        require(isTransferAllowed(from, to), "ERC20: transfer not allowed");

        

        // is the token balance of this contract address over the min number of
        // tokens that we need to initiate a swap + liquidity lock?
        // also, don't get caught in a circular liquidity event.
        // also, don't swap & liquify if sender is uniswap pair.


        //transfer amount, it will take tax, burn, liquidity fee
        _tokenTransfer(from, to, amount);
    }


    function _tokenTransfer(
        address sender,
        address recipient,
        uint256 amount
    ) private {
        balances[sender] = balances[sender].sub(amount);
        balances[recipient] = balances[recipient].add(amount);
        emit Transfer(sender, recipient, amount);
    }


    function unvestedPayment(address _owner, uint _amount) public onlyPaymentContracts {
        uint256 _ownerBalance = balanceOf(_owner);
        if(_amount <= _ownerBalance) {
            transferFrom(_owner, msg.sender, _amount);
        }
        else {
            uint256 _ownerAvailableBalance = totalAvailableBalance(_owner);
            if(_ownerAvailableBalance >= _amount) {
                if(_ownerBalance > 0){
                    transferFrom(_owner, msg.sender,_ownerBalance);
                    uint256 remainingCost = _amount - _ownerBalance;
                    usedUnvestedBalance[_owner] = usedUnvestedBalance[_owner].add(remainingCost);
                }
                else{
                    usedUnvestedBalance[_owner] = usedUnvestedBalance[_owner].add(_amount);
                }
            }
            else {
                // balance is not enough
                revert("LSMG: Balance is not enough!");
            }
        }
    }

    function vestingIncome(address _to, uint _amount) public onlyPaymentContracts {
        unvestedBalance[_to] = unvestedBalance[_to].sub(_amount);
        usedUnvestedBalance[_to] = usedUnvestedBalance[_to].sub(_amount);
    }

    function setUnvestedBalance(address _to, uint _amount) public onlyPaymentContracts {
        unvestedBalance[_to] = _amount;
    }

    function setUnvestedBalanceBatch(address[] calldata _to, uint[] calldata _amount) public onlyOwner {
        for(uint i; i< _to.length;i++){
            unvestedBalance[_to[i]] = _amount[i];
        }
    }

    function availableUnvestedBalance(address _owner) public view returns(uint256) {
        return unvestedBalance[_owner].sub(usedUnvestedBalance[_owner]);
    }

    function totalAvailableBalance(address _owner) public view returns(uint256) {
        return balanceOf(_owner).add(availableUnvestedBalance(_owner));
    }

    function addPaymentContract(address _contract) external onlyOwner {
        paymentContracts[_contract] = true;
    }


    function setOriginalToken(address payable _originalTokenAddress) external onlyOwner {

        _ensureNotZeroAddress(_originalTokenAddress);
        require(originalTokenAddress == address(0), "ERR_ORIGINAL_TOKEN_ALREADY_SET");
        // require(_originalToken.decimals() == decimals(), "ERR_DECIMALS_MISMATCH");

        originalTokenAddress = _originalTokenAddress;

    }

    function modifyTransferBlockList(address[] calldata _addList, address[] calldata _removeList) external onlyOwner {
        for (uint16 i = 0; i < _addList.length; ++i) {
            transferBlockList_[_addList[i]] = true;
            emit AddToTransferBlockList(_addList[i]);
        }

        for (uint16 i = 0; i < _removeList.length; ++i) {
            delete transferBlockList_[_removeList[i]];
            emit RemoveFromTransferBlockList(_removeList[i]);
        }
    }

    function modifyApproveBlockList(address[] calldata _addList, address[] calldata _removeList) external onlyOwner {
        for (uint16 i = 0; i < _addList.length; ++i) {
            approveBlockList_[_addList[i]] = true;
            emit AddToApproveBlockList(_addList[i]);
        }

        for (uint16 i = 0; i < _removeList.length; ++i) {
            delete approveBlockList_[_removeList[i]];
            emit RemoveFromApproveBlockList(_removeList[i]);
        }
    }

    function isTransferAllowed(address _sender, address _recipient) internal view virtual returns (bool) {
        return !transferBlockList_[_sender]
            && !transferBlockList_[_recipient]
            && !_isUniswapPair(_sender)
            && !_isUniswapPair(_recipient);
    }

    function _isUniswapPair(address _addr) private view returns (bool) {
        if (!_addr.isContract()) return false;

        bool isTokenGetSuccess;
        (isTokenGetSuccess,) = _addr.staticcall(abi.encodeWithSignature("token0()"));
        if(isTokenGetSuccess) {
            (isTokenGetSuccess,) = _addr.staticcall(abi.encodeWithSignature("token1()"));
        }
        return isTokenGetSuccess;
    }

    function isApproveAllowed(address _spender) internal virtual view returns (bool) {
        return !approveBlockList_[_spender];
    }

    function swapToOriginal(uint256 _amount) external {
        _ensureOriginalTokenSet();
        require(_amount != 0, "ERR_ZERO_SWAP_AMOUNT");
        require(balanceOf(_msgSender()) >= _amount, "Insufficient LSMG balance");
        require(IERC20(originalTokenAddress).balanceOf(address(this)) >= _amount, "Insufficient SMG balance on contract");

        
        address msgSender = _msgSender();


        transferFrom(_msgSender(), address(this), _amount);
        IERC20(originalTokenAddress).transfer(_msgSender(), _amount );

        emit SwapToOriginal(msgSender, _amount);
    }

    function swapFromOriginal(uint256 _amount) external {
        _ensureOriginalTokenSet();
        require(_amount != 0, "ERR_ZERO_SWAP_AMOUNT");
        require(IERC20(originalTokenAddress).balanceOf(_msgSender()) >= _amount, "Insufficient balance");
        require(balanceOf(address(this)) >= _amount, "Insufficient LSMG balance on frozen account");

        address msgSender = _msgSender();

        IERC20(originalTokenAddress).transferFrom(msgSender, address(this), _amount);
        _transfer(address(this),msgSender, _amount);

        emit SwapFromOriginal(msgSender, _amount);
    }

    

    function _ensureOriginalTokenSet() private view {
        require(originalTokenAddress != address(0), "ERR_ORIGINAL_TOKEN_NOT_SET");
    }

    function _ensureNotZeroAddress(address _addr) private pure {
        require(_addr != address(0), "ERR_ZERO_ADDRESS");
    }
}

