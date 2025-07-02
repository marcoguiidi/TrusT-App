// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./IndividualWalletInfo.sol"; // Importa il contratto IndividualWalletInfo
import "@openzeppelin/contracts/access/Ownable.sol"; // Per Ownable

// Interfaccia minima per chiamare metodi su IndividualWalletInfo
interface IIndividualWalletInfo {
    function owner() external view returns (address);
    function getAssociatedWallet() external view returns (address);
    function transferOwnership(address newOwner) external; // Necessario per chiamare da qui
}

contract UserCompanyRegistry is Ownable {
    // Mappa gli indirizzi dei wallet utente/azienda ai loro contratti IndividualWalletInfo.
    mapping(address => address) public walletToInfo;

    event IndividualWalletInfoCreated(address indexed userWallet, address indexed infoContractAddress);
    event OwnershipTransferredToUser(address indexed userWallet, address indexed infoContractAddress);

    // Il costruttore imposta il deployer del Registry come owner del Registry.
    constructor() Ownable(msg.sender) {}

    // *** NUOVA FUNZIONE CHIAVE: Crea e trasferisce la proprietà, chiamabile da TUTTI! ***
    // L'utente chiamerà questa funzione direttamente dalla sua app.
    function registerAndCreateIndividualWalletInfo() public returns (address newInfoContractAddress) {
        // Verifica che il chiamante (l'utente) non abbia già un contratto info.
        require(walletToInfo[msg.sender] == address(0), "Wallet already has an info contract.");

        // 1. Deploy di una nuova istanza di IndividualWalletInfo.
        // Il costruttore di IndividualWalletInfo prende:
        // msg.sender: l'indirizzo del wallet che sarà l'associatedWallet.
        // address(this): l'indirizzo di questo Registry, che sarà l'owner INIZIALE dell'IndividualWalletInfo.
        IndividualWalletInfo infoContract = new IndividualWalletInfo(msg.sender, address(this));

        // 2. Memorizza la mappatura nel Registry.
        walletToInfo[msg.sender] = address(infoContract);

        // 3. Emetti un evento per tracciare la creazione.
        emit IndividualWalletInfoCreated(msg.sender, address(infoContract));

        // 4. *** Trasferisci la proprietà del contratto IndividualWalletInfo appena creato ***
        // *** al chiamante (msg.sender), ovvero l'utente. ***
        // Questa chiamata è permessa perché il Registry (address(this)) è l'owner temporaneo di infoContract.
        infoContract.transferOwnership(msg.sender);
        emit OwnershipTransferredToUser(msg.sender, address(infoContract));

        return address(infoContract);
    }

    // Vecchia funzione di creazione onlyOwner (puoi mantenerla per compatibilità o rimuoverla)
    // Se non vuoi nessun intervento amministrativo, questa funzione potrebbe non servire più.
    // Per ora la lascio, ma la funzione sopra è quella che userai.
    function createIndividualWalletInfo(address _walletAddress) public onlyOwner returns (address newInfoContract) {
        require(_walletAddress != address(0), "Invalid wallet address");
        require(walletToInfo[_walletAddress] == address(0), "Wallet already has an info contract");

        IndividualWalletInfo infoContract = new IndividualWalletInfo(_walletAddress, address(this));
        walletToInfo[_walletAddress] = address(infoContract);
        emit IndividualWalletInfoCreated(_walletAddress, address(infoContract));

        infoContract.transferOwnership(_walletAddress); // Trasferisce la proprietà qui
        emit OwnershipTransferredToUser(_walletAddress, address(infoContract));

        return address(infoContract);
    }


    // Restituisce l'indirizzo del contratto IndividualWalletInfo per un dato wallet.
    function getIndividualWalletInfoAddress(address _walletAddress) public view returns (address) {
        return walletToInfo[_walletAddress];
    }

    // Permette di recuperare l'owner di un contratto IndividualWalletInfo.
    function getInfoContractOwner(address _walletAddress) public view returns (address) {
        address infoAddress = walletToInfo[_walletAddress];
        if (infoAddress == address(0)) {
            return address(0);
        }
        // Utilizza l'interfaccia per chiamare il metodo owner() sul contratto.
        return IIndividualWalletInfo(infoAddress).owner();
    }
}