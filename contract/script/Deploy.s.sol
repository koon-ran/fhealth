// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "forge-std/Script.sol";
import "../src/ArcEscrow.sol";

/**
 * @title DeployArcEscrow
 * @notice Deployment script for ArcEscrow contract on Sepolia
 * @dev Run with: forge script script/Deploy.s.sol:DeployArcEscrow --rpc-url $SEPOLIA_RPC_URL --broadcast --private-key $PRIVATE_KEY
 */
contract DeployArcEscrow is Script {
    // Circle USDC on Sepolia
    address constant SEPOLIA_USDC = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
    
    function run() external {
        // Read environment variables
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address treasury = vm.envAddress("TREASURY_ADDRESS");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy ArcEscrow
        ArcEscrow escrow = new ArcEscrow(treasury, SEPOLIA_USDC);
        
        vm.stopBroadcast();
        
        // Log deployment info
        console.log("========================================");
        console.log("Escrow Deployment Complete");
        console.log("========================================");
        console.log("Network: Sepolia");
        console.log("Chain ID: 11155111");
        console.log("========================================");
        console.log("Deployed Contracts:");
        console.log("ArcEscrow:", address(escrow));
        console.log("========================================");
        console.log("Configuration:");
        console.log("Treasury:", treasury);
        console.log("USDC Address:", escrow.USDC());
        console.log("Platform Fee:", escrow.PLATFORM_FEE_BPS(), "bps (1%)");
        console.log("Arbiter Fee:", escrow.ARBITER_FEE_BPS(), "bps (2%)");
        console.log("========================================");
        console.log("Verification Command:");
        console.log("forge verify-contract", address(escrow), "src/ArcEscrow.sol:ArcEscrow");
        console.log("  --chain-id 11155111");
        console.log("  --constructor-args $(cast abi-encode 'constructor(address,address)' ", treasury, SEPOLIA_USDC, ")");
        console.log("========================================");
    }
}
