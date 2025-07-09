import TulTokenContractData from "./TulTokenContractData.json";
import UserCompanyRegistryContractData from "./UserCompanyRegistryContractData.json";

export interface ContractAddresses {
  userCompanyRegistry: string;
  tulToken: string;
  zoniaContract: string;
  zoniaToken: string;
}

export const chainIdToContractAddresses: {
  [chainId: number]: ContractAddresses;
} = {
  11155111: {
    userCompanyRegistry: "0xA2b1D9F6841f9c907d85755030C0a158d2DE998e",
    tulToken: "0xc9274F47FF98Fe987E233CD34aF50F962c2C6D2D",
    zoniaContract: "0xbb6849DC5D97Bd55DE9A23B58CD5bBF3Bfdda0FA",
    zoniaToken: "0x8821aFDa84d71988cf0b570C535FC502720B33DD",
  },
  31337: {
    userCompanyRegistry: UserCompanyRegistryContractData.address,
    tulToken: TulTokenContractData.address,
    zoniaContract: "0xbb6849DC5D97Bd55DE9A23B58CD5bBF3Bfdda0FA",
    zoniaToken: "0x8821aFDa84d71988cf0b570C535FC502720B33DD",
  },
};
