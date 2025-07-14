import TulTokenContractData from "./TulTokenContractData.json";
import UserCompanyRegistryContractData from "./UserCompanyRegistryContractData.json";
import IndividualWalletInfoABIJson from "./IndividualWalletInfoABI.json";
import SmartInsuranceABIJson from "./SmartInsuranceABI.json";
import GateABIJson from "./Gate.json";
import ZoniaTokenData from "./ZoniaToken.json";

export const TUL_TOKEN_ABI = TulTokenContractData.abi;

export const USER_COMPANY_REGISTRY_ABI = UserCompanyRegistryContractData.abi;

export const INDIVIDUAL_WALLET_INFO_ABI = IndividualWalletInfoABIJson;

export const SMART_INSURANCE_ABI = SmartInsuranceABIJson;

export const GATE_ABI = GateABIJson.abi;

export const ZONIA_TOKEN_ABI = ZoniaTokenData.abi;

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
