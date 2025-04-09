import { ethers } from "hardhat";

async function main() {
  console.log("Deploying SequencerStaking contract to local network...");

  // Get the deployer's account
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying contracts with the account: ${deployer.address}`);
  
  // Get deployer balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Account balance: ${ethers.formatEther(balance)} ETH`);

  // Deploy SequencerStaking
  const SequencerStaking = await ethers.getContractFactory("SequencerStaking");
  const sequencerStaking = await SequencerStaking.deploy();
  await sequencerStaking.waitForDeployment();

  const address = await sequencerStaking.getAddress();
  console.log(`SequencerStaking deployed to: ${address}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 