import TulTokenContractData from "./TulTokenContractData.json";
import UserCompanyRegistryContractData from "./UserCompanyRegistryContractData.json";

// Interfaccia per definire la struttura degli indirizzi per una data rete
export interface ContractAddresses {
  userCompanyRegistry: string;
  tulToken: string;
  zoniaContract: string;
}

export const chainIdToContractAddresses: {
  [chainId: number]: ContractAddresses;
} = {
  11155111: {
    userCompanyRegistry: UserCompanyRegistryContractData.address,
    tulToken: TulTokenContractData.address,
    zoniaContract: "0xfb663f4fc2624366B527c0d97271405D14503121",
  },
  31337: {
    userCompanyRegistry: UserCompanyRegistryContractData.address,
    tulToken: TulTokenContractData.address,
    zoniaContract: "0xfb663f4fc2624366B527c0d97271405D14503121",
  },
};
