// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./IndividualWalletInfo.sol";

contract SmartInsurance is Ownable {
    address public userWallet;
    address public companyWallet;
    uint256 public premiumAmount;
    string public query;
    string public sensor;
    uint256 public target_value;
    string public geoloc;
    uint256 public payoutAmount;
    address public tokenAddress;

    address public userIndividualWalletInfo;
    address public companyIndividualWalletInfo;

    enum Status { Pending, Active, Claimed, Cancelled }
    Status public currentStatus;

    event PolicyCreated(address indexed user, address indexed company, uint256 premium, uint256 payout);
    event PremiumPaid(address indexed payer, uint256 amount);
    event PayoutExecuted(address indexed recipient, uint256 amount);
    event PolicyCancelled();
    event StatusChanged(Status newStatus);

    constructor(
        address _userWallet,
        address _companyWallet,
        uint256 _premiumAmount,
        string  memory _query,
        string memory _sensor,
        uint256 _target_value,
        string memory _geoloc,
        uint256 _payoutAmount,
        address _tokenAddress,
        address _userIndividualWalletInfo,
        address _companyIndividualWalletInfo
    ) Ownable(msg.sender) {
        require(_userWallet != address(0), "Invalid user wallet");
        require(_companyWallet != address(0), "Invalid company wallet");
        require(_userWallet != _companyWallet, "User and company cannot be the same");
        require(_premiumAmount > 0, "Premium must be greater than zero");
        require(_payoutAmount > 0, "Payout must be greater than zero");
        require(bytes(_query).length > 0, "Query cannot be empty");
        require(_tokenAddress != address(0), "Invalid token address");
        require(_userIndividualWalletInfo != address(0), "Invalid user IndividualWalletInfo address");
        require(_companyIndividualWalletInfo != address(0), "Invalid company IndividualWalletInfo address");


        userWallet = _userWallet;
        companyWallet = _companyWallet;
        premiumAmount = _premiumAmount;
        query = _query;
        sensor = _sensor;
        target_value = _target_value;
        geoloc = _geoloc;
        payoutAmount = _payoutAmount;
        tokenAddress = _tokenAddress;
        currentStatus = Status.Pending;
        userIndividualWalletInfo = _userIndividualWalletInfo;
        companyIndividualWalletInfo = _companyIndividualWalletInfo;


        emit PolicyCreated(userWallet, companyWallet, premiumAmount, payoutAmount);
        emit StatusChanged(Status.Pending);

        IndividualWalletInfo(userIndividualWalletInfo).addSmartInsuranceContract(address(this));
        IndividualWalletInfo(companyIndividualWalletInfo).addSmartInsuranceContract(address(this));
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

        IERC20 token = IERC20(tokenAddress);
        require(token.transferFrom(companyWallet, userWallet, payoutAmount), "Token transfer failed");

        currentStatus = Status.Claimed;
        emit PayoutExecuted(userWallet, payoutAmount);
        emit StatusChanged(Status.Claimed);

        IndividualWalletInfo(userIndividualWalletInfo).updateSmartInsuranceStatus(address(this));
        IndividualWalletInfo(companyIndividualWalletInfo).updateSmartInsuranceStatus(address(this));
    }

    function cancelPolicy() public onlyOwner {
        require(currentStatus == Status.Pending || currentStatus == Status.Active, "Policy cannot be cancelled in current status");
        currentStatus = Status.Cancelled;
        emit PolicyCancelled();
        emit StatusChanged(Status.Cancelled);

        IndividualWalletInfo(userIndividualWalletInfo).updateSmartInsuranceStatus(address(this));
        IndividualWalletInfo(companyIndividualWalletInfo).updateSmartInsuranceStatus(address(this));
    }
}