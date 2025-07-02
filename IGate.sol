// SPDX-License-Identifier: MIT 
pragma solidity ^0.8.0;

import {DataTypes} from "../libraries/types/DataTypes.sol";

interface IGate {
    function submitRequest(DataTypes.InputRequest calldata inputRequest) external returns (bytes32);

    function submitSeed(string memory did, bytes32 requestId, string calldata seed, string calldata pubKey) external;

    function invalidateSeed(string memory did, bytes32 requestId) external;

    function submitCommitteeHash(string memory did, bytes32 requestId, bytes32 committeeHash) external;

    function submitCommittee(string memory did, bytes32 requestId, address[] calldata committee) external;

    function applyToRequest(string memory did, bytes32 requestId) external;

    function closeIndexerRegistration(string memory did, bytes32 requestId) external;

    function submitHash(string memory did, bytes32 requestId, string memory hashData) external;

    function submitDataPoints(string memory did, bytes32 requestId, string[] memory dataPoints) external;

    function submitResult(string memory did, bytes32 requestId, string memory result) external;
    
    function submitRequestTimeout(string memory did, bytes32 requestId, string memory result) external;

    function commitScoreHash(string memory did, bytes32 requestId, bytes32 scoreHash) external;

    function updateScores(
        string memory did,
        bytes32 requestId,
        address[] calldata idxAddrs,
        int256[] calldata idxScores,
        address[] calldata oraAddrs,
        int256[] calldata oraScores
    ) external;

    function banOracles(string calldata did, string[] calldata targetDids) external;

    function banIndexers(string calldata did, string[] calldata targetDids) external;

    function getResult(bytes32 requestId) external view returns (string memory);
    
    function getRequest(bytes32 requestId) external view returns (DataTypes.Request memory);

    function isCommitteeMember(string memory did, bytes32 requestId) external view returns (bool);

    function getOracleRequestData(bytes32 requestId, string[] calldata oraclesDids, uint256 limitTimestamp) external view returns (DataTypes.OracleData[] memory);
}