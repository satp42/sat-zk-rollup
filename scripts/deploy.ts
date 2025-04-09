import { ethers } from "hardhat";

async function main() {
  console.log("Deploying SequencerStaking contract...");

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