// SPDX-License-Identifier: BSD-3-Clause
pragma solidity ^0.8.27;

import "@openzeppelin/confidential-contracts/token/ERC7984/extensions/ERC7984ERC20Wrapper.sol";
import {ZamaSepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title ConfidentialUSDCWrapper
 * @notice Wraps ERC20 USDC into confidential ERC7984 tokens (1:1 ratio)
 * @dev Inherits from OpenZeppelin's ERC7984ERC20Wrapper and Zama's Sepolia config
 * 
 * This contract allows users to:
 * - wrap(): Convert regular USDC to confidential cUSDC (encrypted balance)
 * - unwrap(): Convert confidential cUSDC back to regular USDC
 * - confidentialTransfer(): Transfer encrypted tokens privately
 * - confidentialBalanceOf(): Get encrypted balance handle (requires decryption)
 * 
 * All balances and transfer amounts are encrypted using Zama's FHE (Fully Homomorphic Encryption)
 */
contract ConfidentialUSDCWrapper is ZamaSepoliaConfig, ERC7984ERC20Wrapper {
    
    /**
     * @notice Initialize the confidential USDC wrapper
     * @param underlyingToken Address of the underlying USDC token
     * @param name Token name (e.g., "Confidential USDC")
     * @param symbol Token symbol (e.g., "cUSDC")
     * @param uri Optional metadata URI
     */
    constructor(
        address underlyingToken,
        string memory name,
        string memory symbol,
        string memory uri
    ) ERC7984(name, symbol, uri) ERC7984ERC20Wrapper(IERC20(underlyingToken)) {}
}
