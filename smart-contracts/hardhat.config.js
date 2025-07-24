require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL;
const SEPOLIA_ACCOUNT_KEY = process.env.SEPOLIA_ACCOUNT_KEY;

module.exports = {
  solidity: "0.8.24",
  settings: {
    optimizer: {
      enabled: true,
      runs: 200,
    },
    viaIR: true,
  },
  networks: {
    sepolia: {
      url: SEPOLIA_RPC_URL,
      accounts: SEPOLIA_ACCOUNT_KEY ? [SEPOLIA_ACCOUNT_KEY] : [],
      chainId: 11155111,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
  },
};
