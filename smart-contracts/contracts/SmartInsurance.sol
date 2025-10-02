// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./IGate.sol";
import "./IndividualWalletInfo.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

struct sensorElement {
    string query;
    string sensor;
    uint256 target_value;
    string comparisonType;
    bytes32 zoniaRequestId;
    bool isConditionSatisfied;
}

struct InsuranceInitParams {
    address userWallet;
    address companyWallet;
    uint256 premiumAmount;
    sensorElement[] sensors;
    string  geoloc;
    uint256 payoutAmount;
    address tokenAddress;
    address userIndividualWalletInfo;
    address companyIndividualWalletInfo;
    address zoniaGateAddress;
    address zoniaTokenAddress;
    uint256 expirationTimestamp;
}

contract SmartInsurance is Ownable {
    address public userWallet;
    address public companyWallet;
    uint256 public premiumAmount;
    sensorElement[] public sensors;
    string public geoloc;
    uint256 public payoutAmount;
    address public tokenAddress;
    address public zoniaTokenAddress;

    address public userIndividualWalletInfo;
    address public companyIndividualWalletInfo;

    uint256 public expirationTimestamp;

    enum Status { Pending, Active, Claimed, Cancelled, Expired }
    Status public currentStatus;

    IGate public zoniaGate;

    event PolicyCreated(address indexed user, address indexed company, uint256 premium, uint256 payout);
    event PremiumPaid(address indexed payer, uint256 amount);
    event PayoutExecuted(address indexed recipient, uint256 amount);
    event PolicyCancelled();
    event StatusChanged(Status newStatus);
    event ZoniaRequestSubmitted(bytes32 RequestId);

    constructor(
        InsuranceInitParams memory params
    ) Ownable(msg.sender) {
        require(params.userWallet != address(0), "Invalid user wallet");
        require(params.companyWallet != address(0), "Invalid company wallet");
        require(params.userWallet != params.companyWallet, "User and company cannot be the same");
        require(params.premiumAmount > 0, "Premium must be greater than zero");
        require(params.payoutAmount > 0, "Payout must be greater than zero");
        require(params.tokenAddress != address(0), "Invalid token address");
        require(params.userIndividualWalletInfo != address(0), "Invalid user IndividualWalletInfo address");
        require(params.companyIndividualWalletInfo != address(0), "Invalid company IndividualWalletInfo address");
        require(params.expirationTimestamp > block.timestamp, "Expiration must be in the future");


        userWallet = params.userWallet;
        companyWallet = params.companyWallet;
        premiumAmount = params.premiumAmount;
        for (uint i = 0; i < params.sensors.length; i++) {
            sensors.push(params.sensors[i]);
        }
        geoloc = params.geoloc;
        payoutAmount = params.payoutAmount;
        tokenAddress = params.tokenAddress;
        currentStatus = Status.Pending;
        userIndividualWalletInfo = params.userIndividualWalletInfo;
        companyIndividualWalletInfo = params.companyIndividualWalletInfo;
        zoniaTokenAddress = params.zoniaTokenAddress;

        expirationTimestamp = params.expirationTimestamp;

        zoniaGate = IGate(params.zoniaGateAddress);


        emit PolicyCreated(userWallet, companyWallet, premiumAmount, payoutAmount);
        emit StatusChanged(Status.Pending);
    }

    function allConditionsSatisfied() public view returns (bool) {
        if (currentStatus != Status.Active) {
            return false;
        }
        for (uint i = 0; i < sensors.length; i++) {
            if (!sensors[i].isConditionSatisfied) {
                return false;
            }
        }
        return true;
    }

    function getAllSensors() public view returns (sensorElement[] memory) {
        return sensors;
    }

    function stringToUint(string memory s) public returns (uint, bool) {
        bool hasError = false;
        bytes memory b = bytes(s);
        uint result = 0;
        uint oldResult = 0;
        for (uint i = 0; i < b.length; i++) {
            uint8 charValue = uint8(b[i]);
            if (charValue >= 48 && charValue <= 57) {
                oldResult = result;
                result = result * 10 + (charValue - 48);
                if(oldResult > result ) {
                    hasError = true;
                }
            } else {
                hasError = true;
            }
        }
        return (result, hasError);
    }

    function checkZoniaData(bytes32 requestId, uint index) public {
        require(currentStatus == Status.Active, "Policy not Active");
        require(index < sensors.length, "Invalid sensor index");
        require(sensors[index].zoniaRequestId == requestId, "Mismatching Zonia Request ID for this sensor");

        sensors[index].isConditionSatisfied = false;

        string memory result = zoniaGate.getResult(requestId);

        (uint unitRes, bool success) = stringToUint(result);
        if( success == false ) {
            revert("Impossible to convert result");
        }

        if (keccak256(bytes(sensors[index].comparisonType)) == keccak256(bytes("max"))){
            if( unitRes >= sensors[index].target_value ) {
                sensors[index].isConditionSatisfied = true;
            }
        } else if (keccak256(bytes(sensors[index].comparisonType)) == keccak256(bytes("min"))){
            if( unitRes <= sensors[index].target_value ) {
                sensors[index].isConditionSatisfied = true;
            }
        } else {
            revert("invalid comparison type");
        }
    }

    function submitZoniaCheck(IGate.InputRequest memory inputRequest,uint256 sensorIndex) public {
        require(currentStatus == Status.Active, "Policy not Active");
        require(sensorIndex < sensors.length, "Invalid sensor index");

        IERC20 zoniaToken = IERC20(zoniaTokenAddress);
        require(zoniaToken.transferFrom(userWallet, address(this), inputRequest.fee), "Fee transfer failed");

        require(zoniaToken.approve(address(zoniaGate), inputRequest.fee), "approval failed");

        bytes32 requestId = zoniaGate.submitRequest(inputRequest);

        sensors[sensorIndex].zoniaRequestId = requestId;

        emit ZoniaRequestSubmitted(requestId);
    }

    function depositZoniaFee(uint256 feeAmount) public {

        IERC20 zoniaToken = IERC20(zoniaTokenAddress);
        require(zoniaToken.transferFrom(userWallet, address(this), feeAmount), "Token transfer failed");
    }

    function payPremium() public {
        require(msg.sender == userWallet, "Only the user can pay premium");
        require(currentStatus == Status.Pending, "Policy not in Pending status");

        IERC20 token = IERC20(tokenAddress);
        require(token.transferFrom(msg.sender, companyWallet, premiumAmount), "Token transfer failed");

        currentStatus = Status.Active;
        emit PremiumPaid(msg.sender, premiumAmount);
        emit StatusChanged(Status.Active);

        IndividualWalletInfo(userIndividualWalletInfo).updateSmartInsuranceStatus(address(this));
        IndividualWalletInfo(companyIndividualWalletInfo).updateSmartInsuranceStatus(address(this));
    }

    function executePayout() public {
        require(currentStatus == Status.Active, "Policy not active");
        require(msg.sender == userWallet, "Only the user can require the payout");
        require(allConditionsSatisfied() == true, "Conditions not satisfied");

        IERC20 token = IERC20(tokenAddress);
        require(token.transfer(userWallet, payoutAmount), "Token transfer failed");

        currentStatus = Status.Claimed;
        emit PayoutExecuted(userWallet, payoutAmount);
        emit StatusChanged(Status.Claimed);

        IndividualWalletInfo(userIndividualWalletInfo).updateSmartInsuranceStatus(address(this));
        IndividualWalletInfo(companyIndividualWalletInfo).updateSmartInsuranceStatus(address(this));
    }

    function cancelPolicy() public {
        require(currentStatus == Status.Pending, "Policy cannot be cancelled in current status");
        currentStatus = Status.Cancelled;

        IERC20 token = IERC20(tokenAddress);
        require(token.transfer(companyWallet, payoutAmount), "Token transfer failed");

        emit PolicyCancelled();
        emit StatusChanged(Status.Cancelled);

        IndividualWalletInfo(userIndividualWalletInfo).updateSmartInsuranceStatus(address(this));
        IndividualWalletInfo(companyIndividualWalletInfo).updateSmartInsuranceStatus(address(this));
    }

    function depositForCreation() public {
        require(msg.sender == companyWallet, "Only company can call");

        IERC20 token = IERC20(tokenAddress);
        require(token.transferFrom(companyWallet, address(this), payoutAmount), "Token transfer failed");

        IndividualWalletInfo(userIndividualWalletInfo).addSmartInsuranceContract(address(this));
        IndividualWalletInfo(companyIndividualWalletInfo).addSmartInsuranceContract(address(this));
    }

    function updateStatus(Status newStatus) public {
        require(msg.sender == companyIndividualWalletInfo, "only company IWI can update status with this function");

        currentStatus = newStatus;
        emit StatusChanged(newStatus);
        if (newStatus == Status.Expired) {
            IERC20 token = IERC20(tokenAddress);
            require(token.transfer(companyWallet, payoutAmount), "Token transfer failed");
        }

        IndividualWalletInfo(userIndividualWalletInfo).updateSmartInsuranceStatus(address(this));
        IndividualWalletInfo(companyIndividualWalletInfo).updateSmartInsuranceStatus(address(this));
    }
}