// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/ConfidentialUSDCWrapper.sol";
import "../src/ConfidentialEscrow.sol";

/**
 * @title DeployConfidentialEscrow
 * @notice Deployment script for confidential escrow system on Sepolia with Zama fhEVM
 * @dev Run with: forge script script/DeployConfidential.s.sol:DeployConfidentialEscrow --rpc-url $SEPOLIA_RPC_URL --broadcast --private-key $PRIVATE_KEY
 */
contract DeployConfidentialEscrow is Script {
    // Circle USDC on Sepolia
    address constant SEPOLIA_USDC = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
    
    function run() external {
        // Read environment variables
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address treasury = vm.envAddress("TREASURY_ADDRESS");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // 1. Deploy ConfidentialUSDCWrapper (cUSDC)
        ConfidentialUSDCWrapper wrapper = new ConfidentialUSDCWrapper(
            SEPOLIA_USDC,
            "Confidential USDC",
            "cUSDC",
            ""  // No URI needed
        );
        
        // 2. Deploy ConfidentialEscrow
        ConfidentialEscrow escrow = new ConfidentialEscrow(
            treasury,
            address(wrapper)
        );
        
        vm.stopBroadcast();
        
        // Log deployment info
        console.log("========================================");
        console.log("Confidential Escrow Deployment Complete");
        console.log("========================================");
        console.log("Network: Sepolia (Zama fhEVM)");
        console.log("Chain ID: 11155111");
        console.log("========================================");
        console.log("Deployed Contracts:");
        console.log("ConfidentialUSDCWrapper (cUSDC):", address(wrapper));
        console.log("ConfidentialEscrow:", address(escrow));
        console.log("========================================");
        console.log("Dependencies:");
        console.log("Circle USDC:", SEPOLIA_USDC);
        console.log("Treasury:", treasury);
        console.log("========================================");
        console.log("Fee Structure:");
        console.log("Platform Fee: 1% (100 bps)");
        console.log("Arbiter Fee: 2% (200 bps) - only on disputes");
        console.log("========================================");
        console.log("");
        console.log("IMPORTANT: Update frontend/lib/contracts.ts with:");
        console.log("{");
        console.log("  ConfidentialUSDCWrapper: '", address(wrapper), "',");
        console.log("  ConfidentialEscrow: '", address(escrow), "',");
        console.log("}");
        console.log("========================================");
    }
}
