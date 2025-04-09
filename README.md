# Decentralized Sequencer Staking Contract

This project implements a decentralized staking and rotation mechanism for sequencers in a ZK-Rollup. It allows nodes to register by staking ETH, automatically rotates the leader role among top staked nodes, and includes a slashing mechanism for penalizing malicious behavior.

## Features

- **Permissionless Registration**: Anyone can join by staking ETH (minimum 10 ETH)
- **Leader Rotation**: Round-robin rotation among top 5 staked nodes every 12 seconds
- **Reputation Tracking**: Records missed blocks and other metrics
- **Slashing**: 30% penalty for malicious behavior
- **Secure Withdrawal**: Allows sequencers to unregister and withdraw their stake

## Setup

### Prerequisites

- Node.js (14.x or later)
- npm (6.x or later)

### Installation

1. Clone the repository
```bash
git clone [your-repo-url]
cd zk-rollup
```

2. Install dependencies
```bash
npm install
```

3. Create a `.env` file in the root directory with the following contents:
```
GOERLI_PRIVATE_KEY=your_private_key_here
INFURA_API_KEY=your_infura_api_key_here
ETHERSCAN_API_KEY=your_etherscan_api_key_here
```

## Usage

### Running Tests

```bash
npx hardhat test
```

### Deployment

#### Local Deployment

```bash
npx hardhat node
npx hardhat run scripts/deploy.ts --network localhost
```

#### Goerli Testnet Deployment

```bash
npx hardhat run scripts/deploy.ts --network goerli
```

## Contract Interface

### Main Functions

- `register()`: Register as a sequencer with a minimum stake
- `getCurrentLeader()`: Get the current leader (sequencer) based on time slots
- `slash(address sequencer)`: Slash a sequencer for malicious behavior
- `unregister()`: Unregister and withdraw stake
- `increaseStake()`: Increase your stake amount
- `recordMissedBlock(address sequencer, uint256 blockNumber)`: Record a missed block for a sequencer

### View Functions

- `getTopSequencers()`: Get the current top sequencers by stake
- `getSequencerInfo(address sequencer)`: Get detailed information about a sequencer

## Project Structure

- `contracts/`: Smart contracts
  - `SequencerStaking.sol`: Main staking contract
- `test/`: Test files
- `scripts/`: Deployment scripts

## Security Considerations

- The contract uses OpenZeppelin's ReentrancyGuard to prevent reentrancy attacks
- Owner controls are limited to slashing and recording missed blocks
- Gas optimization for on-chain sorting of sequencers

## License

MIT
