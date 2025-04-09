// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title SequencerStaking
 * @dev Contract for managing the staking and rotation of sequencers in a ZK-Rollup
 */
contract SequencerStaking is ReentrancyGuard, Ownable {
    // Constants
    uint256 public constant MINIMUM_STAKE = 10 ether;
    uint256 public constant SLOT_DURATION = 12 seconds;
    uint256 public constant MAX_SEQUENCERS = 5;
    uint256 public constant SLASH_PERCENTAGE = 30; // 30% penalty for malicious behavior

    // Structs
    struct Sequencer {
        uint256 stake;
        uint256 registrationTime;
        uint256 missedBlocks;
        bool active;
    }

    // State variables
    mapping(address => Sequencer) public sequencers;
    address[] public sequencerList;
    uint256 public totalStaked;
    uint256 public startTime;

    // Events
    event SequencerRegistered(address indexed sequencer, uint256 stake);
    event SequencerUnregistered(address indexed sequencer);
    event SequencerSlashed(address indexed sequencer, uint256 amount);
    event StakeIncreased(address indexed sequencer, uint256 newStake);
    event StakeWithdrawn(address indexed sequencer, uint256 amount);
    event MissedBlockPenalty(address indexed sequencer, uint256 blockNumber);

    constructor() Ownable() {
        startTime = block.timestamp;
        _transferOwnership(msg.sender);
    }

    /**
     * @dev Allows a node to register as a sequencer by staking ETH
     */
    function register() external payable nonReentrant {
        require(msg.value >= MINIMUM_STAKE, "Stake too low");
        require(!sequencers[msg.sender].active, "Already registered");
        
        sequencers[msg.sender] = Sequencer({
            stake: msg.value,
            registrationTime: block.timestamp,
            missedBlocks: 0,
            active: true
        });
        
        sequencerList.push(msg.sender);
        totalStaked += msg.value;
        
        emit SequencerRegistered(msg.sender, msg.value);
        
        // Sort sequencers if the list exceeds MAX_SEQUENCERS
        if (sequencerList.length > MAX_SEQUENCERS) {
            _sortSequencers();
            
            // If after sorting we're still outside the top MAX_SEQUENCERS, refund
            bool inTopSequencers = false;
            for (uint256 i = 0; i < MAX_SEQUENCERS; i++) {
                if (sequencerList[i] == msg.sender) {
                    inTopSequencers = true;
                    break;
                }
            }
            
            if (!inTopSequencers) {
                _unregisterSequencer(msg.sender);
                payable(msg.sender).transfer(msg.value);
                return;
            }
        }
    }

    /**
     * @dev Allows a sequencer to increase their stake
     */
    function increaseStake() external payable nonReentrant {
        require(sequencers[msg.sender].active, "Not a registered sequencer");
        require(msg.value > 0, "No value sent");
        
        sequencers[msg.sender].stake += msg.value;
        totalStaked += msg.value;
        
        emit StakeIncreased(msg.sender, sequencers[msg.sender].stake);
        
        // Re-sort sequencers if necessary
        _sortSequencers();
    }

    /**
     * @dev Allows a sequencer to withdraw their stake and unregister
     */
    function unregister() external nonReentrant {
        require(sequencers[msg.sender].active, "Not a registered sequencer");
        
        uint256 stake = sequencers[msg.sender].stake;
        _unregisterSequencer(msg.sender);
        
        payable(msg.sender).transfer(stake);
        emit StakeWithdrawn(msg.sender, stake);
    }

    /**
     * @dev Returns the address of the current leader (sequencer)
     */
    function getCurrentLeader() public view returns (address) {
        if (sequencerList.length == 0) {
            return address(0);
        }
        
        uint256 elapsedTime = block.timestamp - startTime;
        uint256 slotIndex = (elapsedTime / SLOT_DURATION) % MAX_SEQUENCERS;
        
        // If we have fewer sequencers than MAX_SEQUENCERS, we need to mod again
        slotIndex = slotIndex % sequencerList.length;
        
        return sequencerList[slotIndex];
    }

    /**
     * @dev Slashes a sequencer for malicious behavior
     * @param sequencer The address of the sequencer to slash
     */
    function slash(address sequencer) external onlyOwner {
        require(sequencers[sequencer].active, "Not a registered sequencer");
        
        uint256 slashAmount = (sequencers[sequencer].stake * SLASH_PERCENTAGE) / 100;
        sequencers[sequencer].stake -= slashAmount;
        totalStaked -= slashAmount;
        
        emit SequencerSlashed(sequencer, slashAmount);
        
        // If stake drops below minimum, unregister
        if (sequencers[sequencer].stake < MINIMUM_STAKE) {
            _unregisterSequencer(sequencer);
            
            // Return remaining stake
            uint256 remainingStake = sequencers[sequencer].stake;
            payable(sequencer).transfer(remainingStake);
            emit StakeWithdrawn(sequencer, remainingStake);
        }
        
        // Re-sort sequencers if necessary
        _sortSequencers();
    }

    /**
     * @dev Records a missed block for a sequencer
     * @param sequencer The address of the sequencer who missed a block
     * @param blockNumber The block number that was missed
     */
    function recordMissedBlock(address sequencer, uint256 blockNumber) external onlyOwner {
        require(sequencers[sequencer].active, "Not a registered sequencer");
        
        sequencers[sequencer].missedBlocks += 1;
        emit MissedBlockPenalty(sequencer, blockNumber);
    }

    /**
     * @dev Get the top sequencers by stake
     * @return An array of the top sequencer addresses
     */
    function getTopSequencers() external view returns (address[] memory) {
        uint256 length = sequencerList.length < MAX_SEQUENCERS ? sequencerList.length : MAX_SEQUENCERS;
        address[] memory topSequencers = new address[](length);
        
        for (uint256 i = 0; i < length; i++) {
            topSequencers[i] = sequencerList[i];
        }
        
        return topSequencers;
    }

    /**
     * @dev Get sequencer info
     * @param sequencer The address of the sequencer
     * @return stake The amount staked
     * @return registrationTime When the sequencer registered
     * @return missedBlocks Count of missed blocks
     * @return active Whether the sequencer is active
     */
    function getSequencerInfo(address sequencer) 
        external 
        view 
        returns (
            uint256 stake,
            uint256 registrationTime,
            uint256 missedBlocks,
            bool active
        ) 
    {
        Sequencer memory seq = sequencers[sequencer];
        return (seq.stake, seq.registrationTime, seq.missedBlocks, seq.active);
    }

    /**
     * @dev Internal function to unregister a sequencer
     * @param sequencer The address of the sequencer to unregister
     */
    function _unregisterSequencer(address sequencer) internal {
        totalStaked -= sequencers[sequencer].stake;
        
        // Remove from sequencerList
        for (uint256 i = 0; i < sequencerList.length; i++) {
            if (sequencerList[i] == sequencer) {
                // Replace with the last element and pop
                sequencerList[i] = sequencerList[sequencerList.length - 1];
                sequencerList.pop();
                break;
            }
        }
        
        // Update the sequencer's info
        sequencers[sequencer].active = false;
        
        emit SequencerUnregistered(sequencer);
    }

    /**
     * @dev Sort sequencers by stake (bubble sort for simplicity)
     * Note: In a production environment, this would need to be optimized
     */
    function _sortSequencers() internal {
        for (uint256 i = 0; i < sequencerList.length; i++) {
            for (uint256 j = 0; j < sequencerList.length - i - 1; j++) {
                if (sequencers[sequencerList[j]].stake < sequencers[sequencerList[j + 1]].stake) {
                    address temp = sequencerList[j];
                    sequencerList[j] = sequencerList[j + 1];
                    sequencerList[j + 1] = temp;
                }
            }
        }
    }
} 