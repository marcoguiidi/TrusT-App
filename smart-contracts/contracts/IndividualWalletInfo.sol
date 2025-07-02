// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";

// Definizione dei tipi di wallet
    enum WalletType {
        None,   // 0
        User,   // 1
        Company // 2
    }

contract IndividualWalletInfo is Ownable {
    address public associatedWallet;
    WalletType public walletType;

    // Nuovo mapping per autorizzare gli indirizzi a gestire le assicurazioni
    mapping(address => bool) public isInsuranceManager;

    event WalletTypeSet(WalletType newType);
    event SmartInsuranceAdded(address indexed insuranceContract);
    event InsuranceManagerSet(address indexed manager, bool status); // Nuovo evento

    constructor(address _associatedWallet, address _initialOwner) Ownable(_initialOwner) {
        require(_associatedWallet != address(0), "Invalid associated wallet address");
        associatedWallet = _associatedWallet;
        walletType = WalletType.None;
        // L'owner iniziale (UserCompanyRegistry) è un gestore di default
        isInsuranceManager[_initialOwner] = true; // <-- AGGIUNTA
    }

    // Aggiungi una funzione per gestire i manager delle assicurazioni
    // Solo l'owner del contratto IndividualWalletInfo può chiamarla
    function setInsuranceManager(address _manager, bool _status) public onlyOwner {
        require(_manager != address(0), "Invalid manager address");
        isInsuranceManager[_manager] = _status;
        emit InsuranceManagerSet(_manager, _status);
    }

    // Questa funzione imposta il tipo di wallet.
    // DEVE ESSERE CHIAMATA DALL'associatedWallet DOPO CHE LA PROPRIETÀ È STATA TRASFERITA.
    function setWalletType(WalletType _type) public {
        require(msg.sender == associatedWallet, "Only the associated wallet can set its type.");
        require(walletType == WalletType.None, "Wallet type already set.");
        require(_type != WalletType.None, "Cannot set type to None.");

        walletType = _type;
        emit WalletTypeSet(_type);
    }

    address[] public smartInsuranceContracts;

    // Modifica la funzione per consentire all'owner O a un manager autorizzato di aggiungere polizze
    function addSmartInsuranceContract(address _insuranceContract) public {
        // L'owner (associatedWallet) può sempre aggiungere
        // O un indirizzo che è stato autorizzato come InsuranceManager può aggiungere
        // require(msg.sender == owner() || isInsuranceManager[msg.sender], "Only owner or authorized manager can add insurance");
        require(_insuranceContract != address(0), "Invalid insurance contract address");

        // Prevenire duplicati (opzionale ma consigliato)
        for (uint i = 0; i < smartInsuranceContracts.length; i++) {
            require(smartInsuranceContracts[i] != _insuranceContract, "Insurance contract already added");
        }

        smartInsuranceContracts.push(_insuranceContract);
        emit SmartInsuranceAdded(_insuranceContract);
    }

    function getSmartInsuranceContracts() public view returns (address[] memory) {
        return smartInsuranceContracts;
    }

    function getWalletType() public view returns (WalletType) {
        return walletType;
    }

    function getAssociatedWallet() public view returns (address) {
        return associatedWallet;
    }
}