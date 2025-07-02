// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract TulToken is ERC20, Ownable {
    constructor(uint256 initialSupply) ERC20("TulToken", "TTK") Ownable(msg.sender) {
        _mint(msg.sender, initialSupply); // Minta la supply iniziale al deployer
    }

    // Funzione per mintare più token, solo per il proprietario (deployer)
    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
}