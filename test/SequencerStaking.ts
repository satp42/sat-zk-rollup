import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("SequencerStaking", function () {
  let sequencerStaking: any;
  let owner: HardhatEthersSigner;
  let sequencer1: HardhatEthersSigner;
  let sequencer2: HardhatEthersSigner;
  let sequencer3: HardhatEthersSigner;
  const MIN_STAKE = ethers.parseEther("10");

  beforeEach(async function () {
    // Get signers
    [owner, sequencer1, sequencer2, sequencer3] = await ethers.getSigners();

    // Deploy contract
    const SequencerStakingFactory = await ethers.getContractFactory("SequencerStaking");
    sequencerStaking = await SequencerStakingFactory.deploy();
  });

  describe("Registration", function () {
    it("Should allow a node to register as a sequencer", async function () {
      // Register sequencer1
      await sequencerStaking.connect(sequencer1).register({ value: MIN_STAKE });

      // Check sequencer info
      const sequencerInfo = await sequencerStaking.getSequencerInfo(sequencer1.address);
      expect(sequencerInfo[0]).to.equal(MIN_STAKE);
      expect(sequencerInfo[3]).to.be.true;

      // Check sequencer list
      const topSequencers = await sequencerStaking.getTopSequencers();
      expect(topSequencers[0]).to.equal(sequencer1.address);
    });

    it("Should reject registration with insufficient stake", async function () {
      // Try to register with less than minimum stake
      await expect(
        sequencerStaking.connect(sequencer1).register({ value: ethers.parseEther("9") })
      ).to.be.revertedWith("Stake too low");
    });

    it("Should reject a sequencer that tries to register twice", async function () {
      // Register first time
      await sequencerStaking.connect(sequencer1).register({ value: MIN_STAKE });

      // Try to register again
      await expect(
        sequencerStaking.connect(sequencer1).register({ value: MIN_STAKE })
      ).to.be.revertedWith("Already registered");
    });

    it("Should allow a sequencer to increase their stake", async function () {
      // Register
      await sequencerStaking.connect(sequencer1).register({ value: MIN_STAKE });

      // Increase stake
      const additionalStake = ethers.parseEther("5");
      await sequencerStaking.connect(sequencer1).increaseStake({ value: additionalStake });

      // Verify new stake
      const sequencerInfo = await sequencerStaking.getSequencerInfo(sequencer1.address);
      const expectedStake = MIN_STAKE + additionalStake;
      expect(sequencerInfo[0]).to.equal(expectedStake);
    });
  });

  describe("Unregistration", function () {
    it("Should allow a sequencer to unregister and receive their stake", async function () {
      // Register
      await sequencerStaking.connect(sequencer1).register({ value: MIN_STAKE });

      // Check balance before unregistering
      const balanceBefore = await ethers.provider.getBalance(sequencer1.address);

      // Unregister
      const tx = await sequencerStaking.connect(sequencer1).unregister();
      const receipt = await tx.wait();
      const gasFee = BigInt(receipt!.gasUsed) * BigInt(receipt!.gasPrice);

      // Check balance after unregistering (allowing for some rounding in gas calculation)
      const balanceAfter = await ethers.provider.getBalance(sequencer1.address);
      const balanceDiff = balanceAfter - balanceBefore + gasFee;
      
      // Using almostEqual since gas calculations can be slightly imprecise
      expect(balanceDiff).to.be.closeTo(MIN_STAKE, ethers.parseEther("0.0001"));

      // Check sequencer info
      const sequencerInfo = await sequencerStaking.getSequencerInfo(sequencer1.address);
      expect(sequencerInfo[3]).to.be.false;
    });

    it("Should reject unregistration from a non-registered sequencer", async function () {
      await expect(
        sequencerStaking.connect(sequencer1).unregister()
      ).to.be.revertedWith("Not a registered sequencer");
    });
  });

  describe("Leader Rotation", function () {
    it("Should return the correct leader based on time slots", async function () {
      // Register multiple sequencers
      const extraStake1 = ethers.parseEther("1");
      const extraStake2 = ethers.parseEther("2");
      
      await sequencerStaking.connect(sequencer1).register({ value: MIN_STAKE + extraStake1 });
      await sequencerStaking.connect(sequencer2).register({ value: MIN_STAKE });
      await sequencerStaking.connect(sequencer3).register({ value: MIN_STAKE + extraStake2 });

      // Get current leader
      const currentLeader = await sequencerStaking.getCurrentLeader();
      
      // Verify it's one of our sequencers
      const topSequencers = await sequencerStaking.getTopSequencers();
      expect(topSequencers).to.include(currentLeader);
    });
  });

  describe("Slashing", function () {
    it("Should allow the owner to slash a sequencer", async function () {
      // Register
      await sequencerStaking.connect(sequencer1).register({ value: MIN_STAKE });

      // Slash the sequencer
      await sequencerStaking.connect(owner).slash(sequencer1.address);

      // Check reduced stake (30% slashed)
      const sequencerInfo = await sequencerStaking.getSequencerInfo(sequencer1.address);
      const expectedStake = (MIN_STAKE * 70n) / 100n;
      expect(sequencerInfo[0]).to.equal(expectedStake);
    });

    it("Should unregister a sequencer if stake falls below minimum", async function () {
      // Register with just above minimum
      const extraAmount = ethers.parseEther("1");
      const slightlyAboveMin = MIN_STAKE + extraAmount;
      await sequencerStaking.connect(sequencer1).register({ value: slightlyAboveMin });
      
      // Slash once to bring below minimum
      await sequencerStaking.connect(owner).slash(sequencer1.address);
      
      // Check sequencer is unregistered
      const sequencerInfo = await sequencerStaking.getSequencerInfo(sequencer1.address);
      expect(sequencerInfo[3]).to.be.false;
    });

    it("Should only allow the owner to slash", async function () {
      // Register
      await sequencerStaking.connect(sequencer1).register({ value: MIN_STAKE });

      // Try to slash from non-owner
      await expect(
        sequencerStaking.connect(sequencer2).slash(sequencer1.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Missed Blocks", function () {
    it("Should allow recording missed blocks for a sequencer", async function () {
      // Register
      await sequencerStaking.connect(sequencer1).register({ value: MIN_STAKE });

      // Record missed block
      const blockNumber = 123;
      await sequencerStaking.connect(owner).recordMissedBlock(sequencer1.address, blockNumber);

      // Check missed blocks count increased
      const sequencerInfo = await sequencerStaking.getSequencerInfo(sequencer1.address);
      expect(sequencerInfo[2]).to.equal(1);
    });
  });
}); 