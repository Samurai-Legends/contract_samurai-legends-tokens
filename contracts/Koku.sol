// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./ERC20WithFees.sol";

interface Factory {
    function createPair(address tokenA, address tokenB) external returns (address pair);
}

interface Router {
    function factory() external pure returns (address);
}

contract Koku is ERC20WithFees {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    Router public immutable router;
    address public immutable tokenA;
    address public immutable tokenB;
    address public immutable pair;

    uint32 public lastTimeMintedAt;

    constructor(Router _router, address _tokenA) ERC20WithFees("Koku", "KOKU")  {
        /**
        @notice Creates new pair and initialize the state
        */
        router = _router;
        tokenA = _tokenA;
        tokenB = address(this);
        pair = Factory(_router.factory()).createPair(_tokenA, address(this));

        /**

        @notice Gives the router max allowance over the Koku's address
        Owner is Koku's address
        Spender is the router address
        */
        _approve(address(this), address(_router), type(uint256).max);

        /**
        @notice Grants the ADMIN and MINTER roles to contract creator
        */
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(MINTER_ROLE, msg.sender);

        _mint(msg.sender, 100_000 * 1e9);
        lastTimeMintedAt = uint32(block.timestamp);
    }

    function decimals() public view virtual override returns (uint8) {
        return 9;
    }

    function isExcludedFromFees(address account) internal view override returns (bool) {
        return account == owner() || account == address(this);  
    }

    function isPair(address account) internal view override returns (bool) {
        return pair == account;
    }
}