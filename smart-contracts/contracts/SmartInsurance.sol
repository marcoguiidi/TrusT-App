// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol"; // Interfaccia per il tuo token

contract SmartInsurance is Ownable {
    address public userWallet;
    address public companyWallet;
    uint256 public premiumAmount;
    string public insuranceDescription;
    uint256 public payoutAmount;  // Importo del rimborso in token
    address public tokenAddress;  // Indirizzo del tuo token ERC-20 (MyToken)

    enum Status { Pending, Active, Claimed, Cancelled }
    Status public currentStatus;

    event PolicyCreated(address indexed user, address indexed company, uint256 premium, uint256 payout);
    event PremiumPaid(address indexed payer, uint256 amount);
    event PayoutExecuted(address indexed recipient, uint256 amount);
    event PolicyCancelled();

    // Il costruttore imposta i dettagli della polizza
    constructor(
        address _userWallet,
        address _companyWallet,
        uint256 _premiumAmount,
        string memory _insuranceDescription,
        uint256 _payoutAmount,
        address _tokenAddress
    ) Ownable(msg.sender) {
        require(_userWallet != address(0), "Invalid user wallet");
        require(_companyWallet != address(0), "Invalid company wallet");
        require(_userWallet != _companyWallet, "User and company cannot be the same");
        require(_premiumAmount > 0, "Premium must be greater than zero");
        require(_payoutAmount > 0, "Payout must be greater than zero");
        require(_tokenAddress != address(0), "Invalid token address");

        userWallet = _userWallet;
        companyWallet = _companyWallet;
        premiumAmount = _premiumAmount;
        insuranceDescription = _insuranceDescription;
        payoutAmount = _payoutAmount;
        tokenAddress = _tokenAddress;
        currentStatus = Status.Pending;

        emit PolicyCreated(userWallet, companyWallet, premiumAmount, payoutAmount);
    }

    // Funzione per pagare il premio. Chiamata dall'utente.
    function payPremium() public {
        require(msg.sender == userWallet, "Only the user can pay premium");
        require(currentStatus == Status.Pending, "Policy not in Pending status");

        IERC20 token = IERC20(tokenAddress);
        // Trasferisci il premio dal mittente (utente) a questo contratto di assicurazione
        require(token.transferFrom(msg.sender, address(this), premiumAmount), "Token transfer failed");

        currentStatus = Status.Active;
        emit PremiumPaid(msg.sender, premiumAmount);
    }

    // Funzione per eseguire il rimborso. Chiamata dall'azienda (o dal proprietario del contratto).
    function executePayout() public onlyOwner { // Può essere onlyOwner o companyWallet
        require(currentStatus == Status.Active, "Policy not active");

        IERC20 token = IERC20(tokenAddress);
        // Trasferisci il rimborso da questo contratto all'utente
        require(token.transfer(userWallet, payoutAmount), "Token transfer failed");

        currentStatus = Status.Claimed;
        emit PayoutExecuted(userWallet, payoutAmount);
    }

    // Funzione per cancellare la polizza. Può essere chiamata dall'owner.
    function cancelPolicy() public onlyOwner {
        require(currentStatus == Status.Pending || currentStatus == Status.Active, "Policy cannot be cancelled in current status");
        currentStatus = Status.Cancelled;
        emit PolicyCancelled();
    }

    // Permette al proprietario di prelevare i fondi raccolti (se per qualche motivo non sono stati usati)
    function withdrawFunds(address _tokenAddress) public onlyOwner {
        IERC20 token = IERC20(_tokenAddress);
        token.transfer(owner(), token.balanceOf(address(this)));
    }
}