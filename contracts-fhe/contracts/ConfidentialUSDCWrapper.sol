// SPDX-License-Identifier: BSD-3-Clause
pragma solidity ^0.8.27;

import "@openzeppelin/confidential-contracts/token/ERC7984/extensions/ERC7984ERC20Wrapper.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title ConfidentialUSDCWrapper
/// @notice Wraps ERC20 USDC into confidential ERC7984 tokens (1:1 ratio)
/// @dev Uses OpenZeppelin's ERC7984ERC20Wrapper for wrap/unwrap functionality
///
/// Key functions inherited from ERC7984ERC20Wrapper:
/// - wrap(address to, uint256 amount): Deposit USDC, mint encrypted balance
/// - unwrap(address from, address to, externalEuint64 amount, bytes proof): Burn encrypted, receive USDC
/// - confidentialBalanceOf(address): Get encrypted balance handle
/// - confidentialTransfer(address to, externalEuint64 amount, bytes proof): Send encrypted tokens
/// - setOperator(address operator, uint48 until): Allow operator to transfer on your behalf
contract ConfidentialUSDCWrapper is ZamaEthereumConfig, ERC7984ERC20Wrapper {
    constructor(
        address underlyingToken,
        string memory name,
        string memory symbol,
        string memory uri
    ) ERC7984(name, symbol, uri) ERC7984ERC20Wrapper(IERC20(underlyingToken)) {}
}
