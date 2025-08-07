// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./SmartInsurance.sol";

    enum WalletType {
        None,   // 0
        User,   // 1
        Company // 2
    }


contract IndividualWalletInfo is Ownable {
    address public associatedWallet;
    WalletType public walletType;


    event WalletTypeSet(WalletType newType);
    event SmartInsuranceAdded(address indexed insuranceContract);
    event SmartInsuranceStatusUpdated(address indexed insuranceContract);

    constructor(address _associatedWallet, address _initialOwner) Ownable(_initialOwner) {
        require(_associatedWallet != address(0), "Invalid associated wallet address");
        associatedWallet = _associatedWallet;
        walletType = WalletType.None;
    }

    function setWalletType(WalletType _type) public {
        require(msg.sender == associatedWallet, "Only the associated wallet can set its type.");
        require(walletType == WalletType.None, "Wallet type already set.");
        require(_type != WalletType.None, "Cannot set type to None.");

        walletType = _type;
        emit WalletTypeSet(_type);
    }

    address[] public smartInsuranceContracts;
    address[] public activeSmartInsurances;
    address[] public closedSmartInsurances;



    function addSmartInsuranceContract(address _insuranceContract) public {
        require(_insuranceContract != address(0), "Invalid insurance contract address");


        for (uint i = 0; i < smartInsuranceContracts.length; i++) {
            require(smartInsuranceContracts[i] != _insuranceContract, "Insurance contract already added");
        }

        smartInsuranceContracts.push(_insuranceContract);
        emit SmartInsuranceAdded(_insuranceContract);
    }

    function getSmartInsuranceContracts() public view returns (address[] memory) {
        return smartInsuranceContracts;
    }

    function getActiveSmartInsurances() public view returns (address[] memory) {
        return activeSmartInsurances;
    }

    function getClosedSmartInsurances() public view returns (address[] memory) {
        return closedSmartInsurances;
    }

    function getWalletType() public view returns (WalletType) {
        return walletType;
    }

    function getAssociatedWallet() public view returns (address) {
        return associatedWallet;
    }

    function _removeFromArray(address[] storage arr, address _element) internal returns (bool) {
        for (uint i = 0; i < arr.length; i++) {
            if (arr[i] == _element) {
                arr[i] = arr[arr.length - 1];
                arr.pop();
                return true;
            }
        }
        return false;
    }

    function updateSmartInsuranceStatus(address _insuranceContract) public {
        require(_insuranceContract != address(0), "Invalid insurance contract address");

        SmartInsurance insurance = SmartInsurance(_insuranceContract);
        SmartInsurance.Status currentStatus = insurance.currentStatus();

        bool wasInPending = _removeFromArray(smartInsuranceContracts, _insuranceContract);
        bool wasInActive = _removeFromArray(activeSmartInsurances, _insuranceContract);
        bool wasInClosed = _removeFromArray(closedSmartInsurances, _insuranceContract);

        if (!wasInPending && !wasInActive && !wasInClosed) {
            if (currentStatus == SmartInsurance.Status.Pending) {
                smartInsuranceContracts.push(_insuranceContract);
            } else if (currentStatus == SmartInsurance.Status.Active) {
                activeSmartInsurances.push(_insuranceContract);
            } else {
                closedSmartInsurances.push(_insuranceContract);
            }
        } else {
            if (currentStatus == SmartInsurance.Status.Pending) {
                smartInsuranceContracts.push(_insuranceContract);
            } else if (currentStatus == SmartInsurance.Status.Active) {
                activeSmartInsurances.push(_insuranceContract);
            } else {
                closedSmartInsurances.push(_insuranceContract);
            }
        }

        emit SmartInsuranceStatusUpdated(_insuranceContract);
    }

    function batchUpdateExpiredPolicies(address[] calldata _policies) external {
        uint256 currentTime = block.timestamp;
        for (uint256 i = 0; i < _policies.length; i++) {
            address policyAddress = _policies[i];
            SmartInsurance policy = SmartInsurance(policyAddress);

            if (policy.currentStatus() == SmartInsurance.Status.Active || policy.currentStatus() == SmartInsurance.Status.Pending) {
                uint256 expirationTimestamp = policy.expirationTimestamp();

                if (currentTime >= expirationTimestamp) {
                    policy.updateStatus(SmartInsurance.Status.Expired);
                }
            }
        }
    }
}