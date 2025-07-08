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
    userCompanyRegistry: "0x78EE42B1E9BfF4E39a529Bc8551924BAF9bf30bB",
    tulToken: "0xDF115B4846604022Be51c010831F8797afE6686a",
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
