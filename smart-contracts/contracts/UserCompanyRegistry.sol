// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./IndividualWalletInfo.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IIndividualWalletInfo {
    function owner() external view returns (address);
    function getAssociatedWallet() external view returns (address);
    function transferOwnership(address newOwner) external;
}

contract UserCompanyRegistry is Ownable {
    mapping(address => address) public walletToInfo;

    event IndividualWalletInfoCreated(address indexed userWallet, address indexed infoContractAddress);
    event OwnershipTransferredToUser(address indexed userWallet, address indexed infoContractAddress);

    constructor() Ownable(msg.sender) {}

    function registerAndCreateIndividualWalletInfo() public returns (address newInfoContractAddress) {
        require(walletToInfo[msg.sender] == address(0), "Wallet already has an info contract.");

        IndividualWalletInfo infoContract = new IndividualWalletInfo(msg.sender, address(this));

        walletToInfo[msg.sender] = address(infoContract);

        emit IndividualWalletInfoCreated(msg.sender, address(infoContract));

        infoContract.transferOwnership(msg.sender);
        emit OwnershipTransferredToUser(msg.sender, address(infoContract));

        return address(infoContract);
    }

    function createIndividualWalletInfo(address _walletAddress) public onlyOwner returns (address newInfoContract) {
        require(_walletAddress != address(0), "Invalid wallet address");
        require(walletToInfo[_walletAddress] == address(0), "Wallet already has an info contract");

        IndividualWalletInfo infoContract = new IndividualWalletInfo(_walletAddress, address(this));
        walletToInfo[_walletAddress] = address(infoContract);
        emit IndividualWalletInfoCreated(_walletAddress, address(infoContract));

        infoContract.transferOwnership(_walletAddress);
        emit OwnershipTransferredToUser(_walletAddress, address(infoContract));

        return address(infoContract);
    }


    function getIndividualWalletInfoAddress(address _walletAddress) public view returns (address) {
        return walletToInfo[_walletAddress];
    }

    function getInfoContractOwner(address _walletAddress) public view returns (address) {
        address infoAddress = walletToInfo[_walletAddress];
        if (infoAddress == address(0)) {
            return address(0);
        }
        return IIndividualWalletInfo(infoAddress).owner();
    }
}