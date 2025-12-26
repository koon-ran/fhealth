#!/bin/bash
# Install FHE dependencies for confidential escrow

echo "Installing Zama fhEVM Solidity library..."
cd /workspaces/fhealth/contract

# Install fhevm-solidity (Zama's FHE library)
forge install zama-ai/fhevm-solidity --no-commit

# Install OpenZeppelin FHE Contracts (ERC-7984)
echo "Installing OpenZeppelin Confidential Contracts..."
forge install OpenZeppelin/openzeppelin-fhe-contracts --no-commit

echo ""
echo "Dependencies installed!"
echo ""
echo "Make sure your foundry.toml has these remappings:"
echo '  @fhevm/solidity/=lib/fhevm-solidity/'
echo '  @openzeppelin/confidential-contracts/=lib/openzeppelin-fhe-contracts/contracts/'
echo ""
