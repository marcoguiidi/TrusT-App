// SPDX-License-Identifier: MIT 
pragma solidity ^0.8.0;

interface IGate {
    struct ChainParams {
        uint256 w1;
        uint256 w2;
        uint256 w3;
        uint256 w4;
    }

    struct InputRequest {
        string query;
        ChainParams chainParams;
        uint256 ko;
        uint256 ki;
        uint256 fee;
    }

    function submitRequest(InputRequest calldata inputRequest) external returns (bytes32);

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

    function isCommitteeMember(string memory did, bytes32 requestId) external view returns (bool);
}