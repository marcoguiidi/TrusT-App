import TulTokenContractData from "./TulTokenContractData.json";
import UserCompanyRegistryContractData from "./UserCompanyRegistryContractData.json";

export interface ContractAddresses {
  userCompanyRegistry: string;
  tulToken: string;
  zoniaContract: string;
}

export const chainIdToContractAddresses: {
  [chainId: number]: ContractAddresses;
} = {
  11155111: {
    userCompanyRegistry: "0x78EE42B1E9BfF4E39a529Bc8551924BAF9bf30bB",
    tulToken: "0xDF115B4846604022Be51c010831F8797afE6686a",
    zoniaContract: "0xfb663f4fc2624366B527c0d97271405D14503121",
  },
  31337: {
    userCompanyRegistry: UserCompanyRegistryContractData.address,
    tulToken: TulTokenContractData.address,
    zoniaContract: "0xfb663f4fc2624366B527c0d97271405D14503121",
  },
};
