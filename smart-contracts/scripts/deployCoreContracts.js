const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  // /*
  console.log("Deploying core contracts with the account:", deployer.address);
  console.log(
    "Account balance:",
    (await ethers.provider.getBalance(deployer.address)).toString()
  );

  // 1. Deploy del MyToken (TulToken)
  const TulToken = await ethers.getContractFactory("TulToken");
  const initialSupply = ethers.parseEther("1000000");

  const myToken = await TulToken.deploy(initialSupply);
  await myToken.waitForDeployment();
  const myTokenAddress = await myToken.getAddress();
  console.log("TulToken deployed to:", myTokenAddress);

  // --- Distribuzione dei token ai wallet specifici ---
  const wallet1Address = "0xbe90be3dd6747b80972aa17ea26e18153fdc128e";
  const wallet2Address = "0x86cd3d6ef4a74dff8a55f96ab12e3dc4e9464b30";
  const amountToDistribute = ethers.parseEther("100000");

  console.log(
    `Distribuendo ${ethers.formatEther(
      amountToDistribute
    )} TulToken a ${wallet1Address} e ${wallet2Address}...`
  );

  // Invia token al primo wallet
  let tx1 = await myToken.transfer(wallet1Address, amountToDistribute);
  await tx1.wait();
  console.log(
    `Inviati ${ethers.formatEther(
      amountToDistribute
    )} TulToken a ${wallet1Address}. Nuovo saldo: ${ethers.formatEther(
      await myToken.balanceOf(wallet1Address)
    )}`
  );

  let tx2 = await myToken.transfer(wallet2Address, amountToDistribute);
  await tx2.wait();
  console.log(
    `Inviati ${ethers.formatEther(
      amountToDistribute
    )} TulToken a ${wallet2Address}. Nuovo saldo: ${ethers.formatEther(
      await myToken.balanceOf(wallet2Address)
    )}`
  );
  // --- Fine distribuzione token ---

  // 2. Deploy del UserCompanyRegistry
  const UserCompanyRegistry = await ethers.getContractFactory(
    "UserCompanyRegistry"
  );
  const userCompanyRegistry = await UserCompanyRegistry.deploy();
  await userCompanyRegistry.waitForDeployment();
  const registryAddress = await userCompanyRegistry.getAddress();
  console.log("UserCompanyRegistry deployed to:", registryAddress);
  //*/
  // --- Salva i dati dei contratti nella cartella constants del tuo progetto Expo ---
  const constantsDir = path.resolve(__dirname, "../../constants"); // your-expo-project/constants/

  if (!fs.existsSync(constantsDir)) {
    fs.mkdirSync(constantsDir, { recursive: true });
  }
  // /*
  // Dati per MyToken
  const myTokenData = {
    address: myTokenAddress,
    abi: JSON.parse(
      fs
        .readFileSync(
          path.resolve(
            __dirname,
            "../artifacts/contracts/TulToken.sol/TulToken.json"
          )
        )
        .toString()
    ).abi,
  };
  fs.writeFileSync(
    path.resolve(constantsDir, "TulTokenContractData.json"),
    JSON.stringify(myTokenData, null, 2)
  );
  console.log(
    `TulToken contract address and ABI saved to ${constantsDir}/TulTokenContractData.json`
  );

  // Dati per UserCompanyRegistry
  const userCompanyRegistryData = {
    address: registryAddress,
    abi: JSON.parse(
      fs
        .readFileSync(
          path.resolve(
            __dirname,
            "../artifacts/contracts/UserCompanyRegistry.sol/UserCompanyRegistry.json"
          )
        )
        .toString()
    ).abi,
  };
  fs.writeFileSync(
    path.resolve(constantsDir, "UserCompanyRegistryContractData.json"),
    JSON.stringify(userCompanyRegistryData, null, 2)
  );
  console.log(
    `UserCompanyRegistry contract address and ABI saved to ${constantsDir}/UserCompanyRegistryContractData.json`
  );

  //*/

  // Salva solo l'ABI per IndividualWalletInfo (indirizzi dinamici)
  const individualWalletInfoAbi = JSON.parse(
    fs
      .readFileSync(
        path.resolve(
          __dirname,
          "../artifacts/contracts/IndividualWalletInfo.sol/IndividualWalletInfo.json"
        )
      )
      .toString()
  ).abi;
  fs.writeFileSync(
    path.resolve(constantsDir, "IndividualWalletInfoABI.json"),
    JSON.stringify(individualWalletInfoAbi, null, 2)
  );
  console.log(
    `IndividualWalletInfo ABI saved to ${constantsDir}/IndividualWalletInfoABI.json`
  );

  // Salva solo l'ABI per SmartInsurance (indirizzi dinamici)
  const smartInsuranceAbi = JSON.parse(
    fs
      .readFileSync(
        path.resolve(
          __dirname,
          "../artifacts/contracts/SmartInsurance.sol/SmartInsurance.json"
        )
      )
      .toString()
  ).abi;
  fs.writeFileSync(
    path.resolve(constantsDir, "SmartInsuranceABI.json"),
    JSON.stringify(smartInsuranceAbi, null, 2)
  );
  console.log(
    `SmartInsurance ABI saved to ${constantsDir}/SmartInsuranceABI.json`
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
