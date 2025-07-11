import TulTokenContractData from "./TulTokenContractData.json";
import UserCompanyRegistryContractData from "./UserCompanyRegistryContractData.json";
import IndividualWalletInfoABIJson from "./IndividualWalletInfoABI.json";
import SmartInsuranceABIJson from "./SmartInsuranceABI.json";
import GateABIJson from "./Gate.json";
import ZoniaTokenData from "./ZoniaToken.json";

// ABI del tuo token
export const TUL_TOKEN_ABI = TulTokenContractData.abi;

// ABI del tuo registro centrale
export const USER_COMPANY_REGISTRY_ABI = UserCompanyRegistryContractData.abi;

// ABI per le singole istanze di IndividualWalletInfo
export const INDIVIDUAL_WALLET_INFO_ABI = IndividualWalletInfoABIJson;

// ABI per le singole istanze di SmartInsurance
export const SMART_INSURANCE_ABI = SmartInsuranceABIJson;

// ABI per l'istanza del contratto di Zonia
export const GATE_ABI = GateABIJson.abi;

export const ZONIA_TOKEN_ABI = ZoniaTokenData.abi;

// Mappatura di aiuto per i valori dell'enum Solidity
export const SolidityWalletType = {
  None: 0,
  User: 1,
  Company: 2,
};

export const SolidityInsuranceStatus = {
  Pending: 0,
  Active: 1,
  Claimed: 2,
  Cancelled: 3,
};
