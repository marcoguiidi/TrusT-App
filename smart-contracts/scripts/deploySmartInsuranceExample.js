// smart-contracts/scripts/deploySmartInsuranceExample.js
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(
    "Deploying SmartInsurance example with the account:",
    deployer.address
  );
  console.log("Account balance:", (await deployer.getBalance()).toString());

  // Assicurati che MyToken sia già deployato e che il suo indirizzo sia disponibile.
  // Se non lo hai deployato prima, questo fallirà.
  const myTokenDataPath = path.resolve(
    __dirname,
    "../../constants/TulTokenContractData.json"
  );
  if (!fs.existsSync(myTokenDataPath)) {
    console.error(
      "TulTokenContractData.json not found. Please deploy TulToken first using deployCoreContracts.js"
    );
    process.exit(1);
  }
  const myTokenAddress = JSON.parse(
    fs.readFileSync(myTokenDataPath).toString()
  ).address;
  console.log("Using TulToken address:", myTokenAddress);

  // Indirizzi di esempio per utente e azienda
  // Sostituiscili con indirizzi reali per il tuo test
  const userWalletAddress = "0xYourUserWalletAddressHere";
  const companyWalletAddress = "0xYourCompanyWalletAddressHere";

  const premium = ethers.parseEther("100"); // 100 MCT
  const payout = ethers.parseEther("500"); // 500 MCT

  const SmartInsurance = await ethers.getContractFactory("SmartInsurance");
  const smartInsurance = await SmartInsurance.deploy(
    userWalletAddress,
    companyWalletAddress,
    premium,
    payout,
    myTokenAddress
  );
  await smartInsurance.waitForDeployment();
  const insuranceAddress = await smartInsurance.getAddress();
  console.log("SmartInsurance example deployed to:", insuranceAddress);

  // NON salveremo questo contratto nel constants automaticamente,
  // dato che ogni istanza di SmartInsurance è unica.
  // Questo output serve solo per il debug.
  console.log(
    "Remember to add this insurance contract address to the IndividualWalletInfo contracts of both user and company!"
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
