import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  ReactNode,
  useRef,
  SetStateAction,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useWalletConnectModal } from "@walletconnect/modal-react-native";
import { Contract, JsonRpcProvider, ethers } from "ethers";
import { EIP1193Provider } from "@walletconnect/universal-provider";

import {
  USER_COMPANY_REGISTRY_ABI,
  INDIVIDUAL_WALLET_INFO_ABI,
  SMART_INSURANCE_ABI,
  TUL_TOKEN_ABI,
  GATE_ABI,
  SolidityWalletType,
  ZONIA_TOKEN_ABI,
} from "../constants/abis";

import SmartInsuranceArtifact from "../smart-contracts/artifacts/contracts/SmartInsurance.sol/SmartInsurance.json";

import { chainIdToContractAddresses } from "../constants/contractsAddresses";

import { providerMetadata } from "../constants/walletConnectConfig";
import { Alert } from "react-native";
import { reject } from "es-toolkit/compat";

const GLOBAL_TIMEOUT_TX = 20000;

interface IWalletConnectEip1193Provider extends EIP1193Provider {
  request: (args: { method: string; params?: any[] }) => Promise<any>;
}

interface SensorElementFrontend {
  query: string;
  target_value: string;
  comparisonType: string;
  sensor: string;
}

export type ZoniaRequestState =
  | "submitted"
  | "seeded"
  | "ready"
  | "completed"
  | "failed"
  | "initial";

export interface SensorRequestProgress {
  sensorIndex: number;
  sensorQuery: string;
  requestId: string;
  status: ZoniaRequestState;
  result?: string;
  finalCheckSuccess?: boolean;
}

interface SmartInsuranceDetails {
  userWallet: string;
  companyWallet: string;
  premiumAmount: string;
  sensors: SensorElementFrontend[];
  geoloc: string;
  payoutAmount: string;
  tokenAddress: string;
  currentStatus: number;
  expirationTimestamp: number;
}

interface ChainParams {
  w1: number;
  w2: number;
  w3: number;
  w4: number;
}

interface InputRequest {
  query: string;
  chainParams: ChainParams;
  ko: number;
  ki: number;
  fee: number;
}

interface AuthContextType {
  selectedAppRole: "user" | "company" | null;
  selectAppRole: (selectedRole: "user" | "company") => Promise<void>;
  walletConnected: boolean;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => Promise<void>;
  clearAllData: () => Promise<void>;
  walletAddress: string | undefined;
  provider: JsonRpcProvider | undefined;

  walletTypeOnChain: "user" | "company" | null;
  individualWalletInfoAddress: string | null;
  isCoreContractsReady: boolean;
  currentChainId: number | null;

  registerWalletOnChain: (type: "user" | "company") => Promise<void>;

  getWalletTypeOnChain: (
    walletAddr?: string,
    provider?: JsonRpcProvider | null,
    registryContract?: Contract | null,
  ) => Promise<"user" | "company" | null>;
  createSmartInsurance: (
    insuredWalletAddress: string,
    sensors: SensorElementFrontend[],
    geoloc: string,
    premiumAmount: string,
    payoutAmount: string,
    tokenAddress: string,
    expirationTimestamp: bigint,
  ) => Promise<string>;
  getSmartInsurancesForWallet: (
    walletAddr: string,
    status: "pending" | "active" | "closed",
  ) => Promise<string[]>;
  getDetailForSmartInsurance: (
    insuranceAddress: string,
  ) => Promise<SmartInsuranceDetails | null>;
  getMyTokenContract: () => Contract | null;
  getUserCompanyRegistryContract: () => Contract | null;
  getIndividualWalletInfoContract: () => Contract | null;
  getSmartInsuranceContract: (address: string) => Contract | null;
  paySmartInsurancePremium: (insuranceAddress: string) => Promise<void>;
  submitZoniaRequest: (
    insuranceAddress: string,
    ko: number,
    ki: number,
    fee: number,
    updateProgress: UpdateProgressCallback,
    chainParams?: ChainParams,
  ) => Promise<SensorRequestProgress[]>;
  paySmartInsurancePayout: (insuranceAddress: string) => Promise<void>;
  cancelPolicy: (insuranceAddress: string) => Promise<void>;
  zoniaRequestState:
    | "pending"
    | "submitted"
    | "seeded"
    | "ready"
    | "completed"
    | "failed"
    | null;
  clearZoniaRequestState: () => void;
  deploySmartInsuranceState:
    | ""
    | "deploying"
    | "approving"
    | "paying"
    | "failed";
  clearDeployStatus: () => void;
  canRequestPayout: boolean;
  batchUpdateExpiredPolicies: (policyAddresses: string[]) => Promise<void>;
}

type UpdateProgressCallback = (
  requestId: string,
  newStatus: ZoniaRequestState,
  result?: string,
) => void;

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined,
);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [selectedAppRole, setSelectedAppRole] = useState<
    "user" | "company" | null
  >(null);
  const [walletTypeOnChain, setWalletTypeOnChain] = useState<
    "user" | "company" | null
  >(null);
  const [walletConnected, setWalletConnected] = useState<boolean>(false);
  const [isCoreContractsReady, setIsCoreContractsReady] = useState(false);
  const [individualWalletInfoAddress, setIndividualWalletInfoAddress] =
    useState<string | null>(null);
  const [currentChainId, setCurrentChainId] = useState<number | null>(null);

  const [zoniaRequestState, setZoniaRequestState] = useState<
    "pending" | "submitted" | "seeded" | "ready" | "completed" | "failed" | null
  >(null);

  const [deploySmartInsuranceState, setDeploySmartInsuranceState] = useState<
    "deploying" | "approving" | "paying" | "" | "failed"
  >("");

  const [canRequestPayout, setCanRequestPayout] = useState(false);

  const {
    isConnected,
    address,
    provider: wcProvider,
    open,
    close,
  } = useWalletConnectModal();

  const ethersProviderRef = useRef<JsonRpcProvider | null>(null);
  const userCompanyRegistryContractRef = useRef<Contract | null>(null);
  const myTokenContractRef = useRef<Contract | null>(null);
  const individualWalletInfoContractRef = useRef<Contract | null>(null);

  useEffect(() => {
    const loadAuthState = async () => {
      try {
        const storedRole = await AsyncStorage.getItem("selectedAppRole");
        if (storedRole === "user" || storedRole === "company") {
          setSelectedAppRole(storedRole);
        }
      } catch (e) {
        console.error("Failed to load selected app role from storage", e);
      }
    };
    loadAuthState();
  }, []);

  useEffect(() => {
    const initEthers = async () => {
      setIsCoreContractsReady(false);
      setWalletConnected(false);
      userCompanyRegistryContractRef.current = null;
      myTokenContractRef.current = null;
      individualWalletInfoContractRef.current = null;
      setIndividualWalletInfoAddress(null);
      setWalletTypeOnChain(null);
      ethersProviderRef.current = null;
      setCurrentChainId(null);

      if (!wcProvider || !isConnected || !address) {
        console.log("Condizioni WC non soddisfatte per initEthers.");
        return;
      }

      setWalletConnected(true);

      const ngrokUrl = providerMetadata.url;
      if (!ngrokUrl) {
        console.error(
          "ERRORE: URL di ngrok non configurato in providerMetadata.url. Impossibile procedere.",
        );
        setIsCoreContractsReady(false);
        return;
      }

      let localProvider: JsonRpcProvider | null = null;
      let localChainId: number | null = null;
      let localRegistryContract: Contract | null = null;

      try {
        localProvider = new JsonRpcProvider(ngrokUrl);
        ethersProviderRef.current = localProvider;
        const network = await localProvider.getNetwork();
        localChainId = Number(network.chainId);
        setCurrentChainId(localChainId);

        const currentContractAddresses =
          chainIdToContractAddresses[localChainId];

        if (!currentContractAddresses) {
          console.error(
            `ERRORE: Indirizzi dei contratti non configurati per il Chain ID: ${localChainId}. Aggiorna constants/contractAddresses.ts`,
          );
          setIsCoreContractsReady(false);
          return;
        }

        if (
          currentContractAddresses.tulToken &&
          currentContractAddresses.tulToken !== ethers.ZeroAddress
        ) {
          const tokenContract = new Contract(
            currentContractAddresses.tulToken,
            TUL_TOKEN_ABI,
            localProvider,
          );
          myTokenContractRef.current = tokenContract;
        } else {
          console.warn(
            "TulToken address not configured or is zero address. Cannot interact with token.",
          );
          myTokenContractRef.current = null;
        }

        if (
          currentContractAddresses.userCompanyRegistry &&
          currentContractAddresses.userCompanyRegistry !== ethers.ZeroAddress
        ) {
          localRegistryContract = new Contract(
            currentContractAddresses.userCompanyRegistry,
            USER_COMPANY_REGISTRY_ABI,
            localProvider,
          );
          userCompanyRegistryContractRef.current = localRegistryContract;
          setIsCoreContractsReady(true);
        } else {
          console.warn(
            "UserCompanyRegistry address not configured or is zero address. Cannot interact with central registry.",
          );
          setIsCoreContractsReady(false);
          userCompanyRegistryContractRef.current = null;
          return;
        }

        if (localRegistryContract && localProvider) {
          let infoContractAddress =
            await localRegistryContract.getIndividualWalletInfoAddress(address);

          if (infoContractAddress === ethers.ZeroAddress) {
            infoContractAddress = null;
          }

          if (
            infoContractAddress &&
            infoContractAddress !== ethers.ZeroAddress
          ) {
            setIndividualWalletInfoAddress(infoContractAddress);
            const individualContract = new Contract(
              infoContractAddress,
              INDIVIDUAL_WALLET_INFO_ABI,
              localProvider,
            );
            individualWalletInfoContractRef.current = individualContract;

            const typeOnChain = await getWalletTypeOnChain(
              address,
              localProvider,
              localRegistryContract,
            );
            if (typeOnChain) {
              setSelectedAppRole(typeOnChain);
              await AsyncStorage.setItem("selectedAppRole", typeOnChain);
            }
          } else {
            setIndividualWalletInfoAddress(null);
            individualWalletInfoContractRef.current = null;
            setWalletTypeOnChain(null);
          }
        } else {
          console.error(
            "ERRORE: localProvider o localRegistryContract non pronti per la chiamata a getWalletTypeOnChain, ma avrebbero dovuto esserlo. Bug logico.",
          );
        }
      } catch (e) {
        console.error(
          "Errore durante l'inizializzazione di Ethers o dei contratti:",
          e,
        );
        setIsCoreContractsReady(false);
        userCompanyRegistryContractRef.current = null;
        myTokenContractRef.current = null;
        individualWalletInfoContractRef.current = null;
        setIndividualWalletInfoAddress(null);
        setWalletTypeOnChain(null);
        ethersProviderRef.current = null;
        setCurrentChainId(null);
      }
    };

    initEthers();
  }, [isConnected, address, wcProvider]);

  const selectAppRole = async (selectedRole: "user" | "company") => {
    try {
      await AsyncStorage.setItem("selectedAppRole", selectedRole);
      setSelectedAppRole(selectedRole);
    } catch (e) {
      console.error("Failed to save selected app role", e);
    }
  };

  const connectWallet = async () => {
    try {
      await open();
    } catch (e) {
      console.error("Error connecting wallet:", e);
    }
  };

  const disconnectWallet = async () => {
    try {
      // @ts-ignore
      if (wcProvider) {
        // @ts-ignore
        await wcProvider.disconnect();
      }
      await clearAllData();
      console.log("Wallet disconnected and all data cleared.");
    } catch (e) {
      console.error("Error disconnecting wallet:", e);
    }
  };

  const clearAllData = async () => {
    try {
      await AsyncStorage.clear();
      setSelectedAppRole(null);
      setWalletConnected(false);
      setIndividualWalletInfoAddress(null);
      setWalletTypeOnChain(null);
      setIsCoreContractsReady(false);
      ethersProviderRef.current = null;
      userCompanyRegistryContractRef.current = null;
      myTokenContractRef.current = null;
      individualWalletInfoContractRef.current = null;
      setCurrentChainId(null);
    } catch (e) {
      console.error("Error clearing all data:", e);
    }
  };

  const registerWalletOnChain = async (type: "user" | "company") => {
    const currentContractAddresses =
      chainIdToContractAddresses[currentChainId!];
    if (!currentContractAddresses) {
      throw new Error(
        "Contract addresses not available for current network. Please connect to a supported network.",
      );
    }
    const USER_COMPANY_REGISTRY_ADDRESS_CURRENT =
      currentContractAddresses.userCompanyRegistry;

    if (
      !address ||
      !wcProvider ||
      !isCoreContractsReady ||
      !USER_COMPANY_REGISTRY_ADDRESS_CURRENT ||
      currentChainId === null ||
      !ethersProviderRef.current
    ) {
      console.error(
        "Blockchain components not ready for transaction. Check wallet address, wcProvider, currentChainId, or ethersProvider.",
      );
      throw new Error("Blockchain components not ready.");
    }

    try {
      const registryContractRead = new Contract(
        USER_COMPANY_REGISTRY_ADDRESS_CURRENT,
        USER_COMPANY_REGISTRY_ABI,
        ethersProviderRef.current,
      );

      let infoAddress =
        await registryContractRead.getIndividualWalletInfoAddress(address);
      if (infoAddress === ethers.ZeroAddress) {
        infoAddress = null;
      }

      if (!infoAddress) {
        console.log(
          `DEBUG: IndividualWalletInfo non trovato per ${address}. Procedo con creazione e trasferimento proprietà dal Registry.`,
        );

        const registryIface = new ethers.Interface(USER_COMPANY_REGISTRY_ABI);
        const registerData = registryIface.encodeFunctionData(
          "registerAndCreateIndividualWalletInfo",
          [],
        );

        const createTxHash = await (
          wcProvider as IWalletConnectEip1193Provider
        ).request({
          method: "eth_sendTransaction",
          params: [
            {
              from: address,
              to: USER_COMPANY_REGISTRY_ADDRESS_CURRENT,
              data: registerData,
              chainId: `0x${currentChainId.toString(16)}`,
            },
          ],
        });
        const receipt =
          await ethersProviderRef.current.waitForTransaction(createTxHash);
        if (!receipt || receipt.status == 0) {
          throw new Error("Create IWInfo failed");
        }

        infoAddress =
          await registryContractRead.getIndividualWalletInfoAddress(address);
        if (!infoAddress || infoAddress === ethers.ZeroAddress) {
          throw new Error(
            "Errore: Indirizzo IndividualWalletInfo non recuperato dopo la creazione.",
          );
        }
      } else {
      }

      setIndividualWalletInfoAddress(infoAddress);

      individualWalletInfoContractRef.current = new Contract(
        infoAddress!,
        INDIVIDUAL_WALLET_INFO_ABI,
        ethersProviderRef.current,
      );

      let solidityType;
      if (type === "user") {
        solidityType = SolidityWalletType.User;
      } else if (type === "company") {
        solidityType = SolidityWalletType.Company;
      } else {
        throw new Error(
          "Tipo di wallet specificato non valido per la registrazione.",
        );
      }

      const currentTypeOnContract = await (
        individualWalletInfoContractRef.current as Contract
      ).getWalletType();

      if (currentTypeOnContract == solidityType) {
      } else if (currentTypeOnContract != SolidityWalletType.None) {
        console.warn(
          `WARN: Il tipo di wallet sul contratto è ${currentTypeOnContract} ma l'app ha selezionato ${type}. Impossibile modificare il tipo.`,
        );
        throw new Error(
          "Il tipo di wallet è già impostato e non può essere modificato per il contratto di questo wallet.",
        );
      } else {
        console.log(
          `DEBUG: Impostazione del tipo di wallet su ${type} tramite wcProvider.request()...`,
        );

        const individualIface = new ethers.Interface(
          INDIVIDUAL_WALLET_INFO_ABI,
        );
        const setTypeData = individualIface.encodeFunctionData(
          "setWalletType",
          [solidityType],
        );

        const setTypeTxHash = await (
          wcProvider as IWalletConnectEip1193Provider
        ).request({
          method: "eth_sendTransaction",
          params: [
            {
              from: address,
              to: infoAddress!,
              data: setTypeData,
              chainId: `0x${currentChainId.toString(16)}`,
            },
          ],
        });
        console.log(
          `DEBUG: Transazione setWalletType inviata. Hash: ${setTypeTxHash}`,
        );
        const receipt =
          await ethersProviderRef.current.waitForTransaction(setTypeTxHash);
        if (!receipt || receipt.status == 0) {
          throw new Error("SetWallet transaction failed");
        }
        console.log(`DEBUG: Tipo di wallet ${type} registrato con successo!`);
      }

      setWalletTypeOnChain(type);
    } catch (error: any) {
      console.error(
        "ERRORE GLOBALE durante la registrazione del wallet on-chain:",
        error.message || error,
      );
      if (error.data && typeof error.data === "string") {
        const decodedError = ethers.toUtf8String(
          "0x" + error.data.substring(10),
        );
        console.error("Decoded EVM revert reason:", decodedError);
      }
      throw error;
    }
  };

  const paySmartInsurancePremium = async (insuranceAddress: string) => {
    if (
      !insuranceAddress ||
      insuranceAddress === ethers.ZeroAddress ||
      !address ||
      !wcProvider ||
      !currentChainId ||
      !ethersProviderRef.current ||
      !isCoreContractsReady
    ) {
      console.error(
        "Blockchain components not ready: check insuranceAddress, current wallet address, wcProvider, currentChainId, ethersProvider, or core contracts status.",
      );
      throw new Error("Blockchain components not ready to pay premium.");
    }

    try {
      console.log(
        `Attempting to pay premium for SmartInsurance at: ${insuranceAddress} from wallet: ${address}`,
      );

      const tulTokenContract = getMyTokenContract();
      const tulTokenAddress = await tulTokenContract?.getAddress();
      if (!tulTokenContract || !tulTokenAddress) {
        throw new Error(
          "TulToken contract not initialized or address is missing.",
        );
      }

      const tulTokenIface = new ethers.Interface(TUL_TOKEN_ABI);
      const smartInsuranceIface = new ethers.Interface(SMART_INSURANCE_ABI);

      const smartInsuranceContractRead = new Contract(
        insuranceAddress,
        SMART_INSURANCE_ABI,
        ethersProviderRef.current,
      );
      const premiumAmount = await smartInsuranceContractRead.premiumAmount();

      console.log(
        `Sending approval transaction for SmartInsurance ${insuranceAddress} to spend ${ethers.formatEther(premiumAmount)} TulToken...`,
      );

      const approveData = tulTokenIface.encodeFunctionData("approve", [
        insuranceAddress,
        premiumAmount,
      ]);

      const approveTxHash = await (
        wcProvider as IWalletConnectEip1193Provider
      ).request({
        method: "eth_sendTransaction",
        params: [
          {
            from: address,
            to: tulTokenAddress,
            data: approveData,
            chainId: `0x${currentChainId.toString(16)}`,
          },
        ],
      });
      console.log(`Approve transaction sent. Hash: ${approveTxHash}`);

      let approveTimeoutId: NodeJS.Timeout | undefined;
      const approveTimeoutPromise = new Promise<never>((_resolve, reject) => {
        approveTimeoutId = setTimeout(() => {
          Alert.alert("Approve transaction failed", "please try again");
          reject(new Error("Approve transaction confirmation timed out."));
        }, GLOBAL_TIMEOUT_TX);
      });

      const approveReceipt = await Promise.race([
        ethersProviderRef.current.waitForTransaction(approveTxHash),
        approveTimeoutPromise,
      ]);

      clearTimeout(approveTimeoutId);

      if (!approveReceipt || approveReceipt.status == 0) {
        throw new Error("Approve transaction failed");
      }

      console.log("Approval successful and confirmed.");

      console.log(
        "Sending payPremium transaction on SmartInsurance contract...",
      );

      const payPremiumData = smartInsuranceIface.encodeFunctionData(
        "payPremium",
        [],
      );

      const payTxHash = await (
        wcProvider as IWalletConnectEip1193Provider
      ).request({
        method: "eth_sendTransaction",
        params: [
          {
            from: address,
            to: insuranceAddress,
            data: payPremiumData,
            chainId: `0x${currentChainId.toString(16)}`,
          },
        ],
      });
      console.log(`Pay Premium transaction sent. Hash: ${payTxHash}`);

      let payTimeoutId: NodeJS.Timeout | undefined;
      const payTimeoutPromise = new Promise<never>((_resolve, reject) => {
        payTimeoutId = setTimeout(() => {
          Alert.alert("Pay Premium transaction failed", "please try again");
          reject(new Error("Pay Premium transaction confirmation timed out."));
        }, GLOBAL_TIMEOUT_TX);
      });

      const receipt = await Promise.race([
        ethersProviderRef.current.waitForTransaction(payTxHash),
        payTimeoutPromise,
      ]);

      clearTimeout(payTimeoutId);

      if (!receipt || receipt.status == 0) {
        throw new Error("PayPremium transaction failed.");
      }
    } catch (e: any) {
      console.error("Error paying SmartInsurance premium:", e);
      if (e.reason) console.error("Revert reason:", e.reason);
      if (e.code === "UNPREDICTABLE_GAS_LIMIT") {
        console.error(
          "Potrebbe esserci un errore di revert nel contratto o insufficienza di fondi per il gas.",
        );
      }
      throw e;
    }
  };

  const createSmartInsurance = async (
    insuredWalletAddress: string,
    sensors: SensorElementFrontend[],
    geoloc: string,
    premiumAmount: string,
    payoutAmount: string,
    tokenAddress: string,
    expirationTimestamp: bigint,
  ): Promise<string> => {
    if (
      !insuredWalletAddress ||
      insuredWalletAddress === ethers.ZeroAddress ||
      !address ||
      !wcProvider ||
      !currentChainId ||
      !ethersProviderRef.current ||
      !userCompanyRegistryContractRef.current ||
      !isCoreContractsReady ||
      !individualWalletInfoAddress
    ) {
      console.error(
        "Blockchain components not ready for SmartInsurance creation.",
      );
      throw new Error(
        "Blockchain components not ready for SmartInsurance creation.",
      );
    }

    if (!premiumAmount || parseFloat(premiumAmount) <= 0) {
      throw new Error("Premium amount must be greater than zero.");
    }
    if (!payoutAmount || parseFloat(payoutAmount) <= 0) {
      throw new Error("Payout amount must be greater than zero.");
    }
    if (!tokenAddress || tokenAddress === ethers.ZeroAddress) {
      throw new Error("Invalid token address for SmartInsurance.");
    }

    const premiumAmountWei = ethers.parseUnits(premiumAmount, 18);
    const payoutAmountWei = ethers.parseUnits(payoutAmount, 18);

    const companyWalletAddress = address;

    try {
      console.log("Inizio creazione SmartInsurance...");

      const smartInsuranceIface = new ethers.Interface(
        SmartInsuranceArtifact.abi,
      );

      const userWalletInfo =
        await userCompanyRegistryContractRef.current.getIndividualWalletInfoAddress(
          insuredWalletAddress,
        );

      interface sensorInitParams {
        query: string;
        sensor: string;
        target_value: number;
        comparisonType: string;
        zoniaRequestId: string;
        isConditionSatisfied: boolean;
      }

      const ZERO_BYTES_32 =
        "0x0000000000000000000000000000000000000000000000000000000000000000";

      const sensorsToInit: sensorInitParams[] = sensors.map((e) => {
        return {
          query: e.query,
          sensor: e.sensor,
          target_value: parseFloat(e.target_value),
          comparisonType: e.comparisonType,
          zoniaRequestId: ZERO_BYTES_32,
          isConditionSatisfied: false,
        };
      });

      interface InsuranceInitParams {
        userWallet: string;
        companyWallet: string;
        premiumAmount: ethers.BigNumberish;
        sensors: sensorInitParams[];
        geoloc: string;
        payoutAmount: ethers.BigNumberish;
        tokenAddress: string;
        userIndividualWalletInfo: string;
        companyIndividualWalletInfo: string;
        zoniaGateAddress: string;
        zoniaTokenAddress: string;
        expirationTimestamp: bigint;
      }

      const params: InsuranceInitParams = {
        userWallet: insuredWalletAddress,
        companyWallet: companyWalletAddress,
        premiumAmount: premiumAmountWei,
        sensors: sensorsToInit,
        geoloc: geoloc,
        payoutAmount: payoutAmountWei,
        tokenAddress: tokenAddress,
        userIndividualWalletInfo: userWalletInfo,
        companyIndividualWalletInfo: individualWalletInfoAddress,
        zoniaGateAddress:
          chainIdToContractAddresses[currentChainId].zoniaContract,
        zoniaTokenAddress:
          chainIdToContractAddresses[currentChainId].zoniaToken,
        expirationTimestamp: expirationTimestamp,
      };

      const deployData = smartInsuranceIface.encodeDeploy([params]);

      const dataToSend =
        SmartInsuranceArtifact.bytecode + deployData.substring(2);

      console.log(
        "Invio transazione di deploy SmartInsurance tramite MetaMask...",
      );

      const deployTxHash = await (
        wcProvider as IWalletConnectEip1193Provider
      ).request({
        method: "eth_sendTransaction",
        params: [
          {
            from: companyWalletAddress,
            data: dataToSend,
            chainId: `0x${currentChainId.toString(16)}`,
          },
        ],
      });
      console.log(
        "Transazione di deploy SmartInsurance inviata. Hash:",
        deployTxHash,
      );
      setDeploySmartInsuranceState("deploying");

      let deployTimeoutId: NodeJS.Timeout | undefined;
      const deployTimeoutPromise = new Promise<never>((_resolve, reject) => {
        deployTimeoutId = setTimeout(() => {
          setDeploySmartInsuranceState("failed");
          reject(new Error("Deploy transaction confirmation timed out."));
        }, GLOBAL_TIMEOUT_TX);
      });

      const receipt = await Promise.race([
        ethersProviderRef.current.waitForTransaction(deployTxHash),
        deployTimeoutPromise,
      ]);

      clearTimeout(deployTimeoutId);

      if (!receipt || !receipt.contractAddress || receipt.status == 0) {
        throw new Error(
          "Failed to get contract address from deploy transaction receipt.",
        );
      }

      const deployedAddress = receipt.contractAddress;
      console.log("SmartInsurance contratto deployato a:", deployedAddress);

      const tulTokenContract = getMyTokenContract();
      const tulTokenAddress = await tulTokenContract?.getAddress();
      if (!tulTokenContract || !tulTokenAddress) {
        throw new Error(
          "TulToken contract not initialized or address is missing.",
        );
      }

      const tulTokenIface = new ethers.Interface(TUL_TOKEN_ABI);

      const approveData = tulTokenIface.encodeFunctionData("approve", [
        deployedAddress,
        payoutAmountWei,
      ]);

      const approveTxHash = await (
        wcProvider as IWalletConnectEip1193Provider
      ).request({
        method: "eth_sendTransaction",
        params: [
          {
            from: address,
            to: tulTokenAddress,
            data: approveData,
            chainId: `0x${currentChainId.toString(16)}`,
          },
        ],
      });
      console.log(`Approve transaction sent. Hash: ${approveTxHash}`);
      setDeploySmartInsuranceState("approving");

      let approveTimeoutId: NodeJS.Timeout | undefined;
      const approveTimeoutPromise = new Promise<never>((_resolve, reject) => {
        approveTimeoutId = setTimeout(() => {
          setDeploySmartInsuranceState("failed");
          reject(new Error("Approve transaction confirmation timed out."));
        }, GLOBAL_TIMEOUT_TX);
      });

      const approveReceipt = await Promise.race([
        ethersProviderRef.current.waitForTransaction(approveTxHash),
        approveTimeoutPromise,
      ]);

      clearTimeout(approveTimeoutId);

      if (!approveReceipt || approveReceipt.status == 0) {
        throw new Error("Approve payout transaction failed");
      }

      console.log("Approval successful and confirmed.");

      const depositData = smartInsuranceIface.encodeFunctionData(
        "depositForCreation",
        [],
      );

      const depositTxHash = await (
        wcProvider as IWalletConnectEip1193Provider
      ).request({
        method: "eth_sendTransaction",
        params: [
          {
            from: address,
            to: deployedAddress,
            data: depositData,
            chainId: `0x${currentChainId.toString(16)}`,
          },
        ],
      });
      console.log(`deposit transaction sent. Hash: ${depositTxHash}`);
      setDeploySmartInsuranceState("paying");

      let depositTimeoutId: NodeJS.Timeout | undefined;
      const depositTimeoutPromise = new Promise<never>((_resolve, reject) => {
        deployTimeoutId = setTimeout(() => {
          setDeploySmartInsuranceState("failed");
          reject(new Error("Deposit transaction confirmation timed out."));
        }, GLOBAL_TIMEOUT_TX);
      });

      const depositReceipt = await Promise.race([
        ethersProviderRef.current.waitForTransaction(depositTxHash),
        depositTimeoutPromise,
      ]);

      clearTimeout(depositTimeoutId);

      if (!depositReceipt || depositReceipt.status == 0) {
        throw new Error("Deposit payout transaction failed");
      }

      console.log("deposit payout succesfull.");
      setDeploySmartInsuranceState("");

      return deployedAddress;
    } catch (e: any) {
      console.error("Errore durante la creazione della SmartInsurance:", e);
      if (e.reason) console.error("Revert reason:", e.reason);
      if (e.code === "UNPREDICTABLE_GAS_LIMIT") {
        console.error(
          "Potrebbe esserci un errore di revert nel contratto o insufficienza di fondi per il gas.",
        );
      }
      throw e;
    }
  };

  const paySmartInsurancePayout = async (insuranceAddress: string) => {
    if (
      !insuranceAddress ||
      insuranceAddress === ethers.ZeroAddress ||
      !address ||
      !wcProvider ||
      !currentChainId ||
      !ethersProviderRef.current ||
      !isCoreContractsReady
    ) {
      console.error(
        "Blockchain components not ready: check insuranceAddress, current wallet address, wcProvider, currentChainId, ethersProvider, or core contracts status.",
      );
      throw new Error("Blockchain components not ready to pay premium.");
    }

    try {
      console.log(
        `Attempting to pay payout for SmartInsurance at: ${insuranceAddress} to wallet: ${address}`,
      );

      const smartInsuranceIface = new ethers.Interface(SMART_INSURANCE_ABI);

      const smartInsuranceContractRead = new Contract(
        insuranceAddress,
        SMART_INSURANCE_ABI,
        ethersProviderRef.current,
      );
      const payoutAmount = await smartInsuranceContractRead.payoutAmount();
      console.log(
        `payout amount to receive: ${ethers.formatEther(payoutAmount)} TulToken`,
      );

      console.log(
        "Sending executePayout transaction on SmartInsurance contract...",
      );

      const executePayoutData = smartInsuranceIface.encodeFunctionData(
        "executePayout",
        [],
      );

      const payTxHash = await (
        wcProvider as IWalletConnectEip1193Provider
      ).request({
        method: "eth_sendTransaction",
        params: [
          {
            from: address,
            to: insuranceAddress,
            data: executePayoutData,
            chainId: `0x${currentChainId.toString(16)}`,
          },
        ],
      });
      console.log(`executePayout transaction sent. Hash: ${payTxHash}`);
      const receipt = await ethersProviderRef.current.waitForTransaction(
        payTxHash,
        1,
      );

      if (!receipt || receipt.status == 0) {
        throw new Error("executePayout transaction failed.");
      }
    } catch (e: any) {
      console.error("Error receiving SmartInsurance payout:", e);
      if (e.reason) console.error("Revert reason:", e.reason);
      if (e.code === "UNPREDICTABLE_GAS_LIMIT") {
        console.error(
          "Potrebbe esserci un errore di revert nel contratto o insufficienza di fondi per il gas.",
        );
      }
      throw e;
    }
  };

  const cancelPolicy = async (insuranceAddress: string) => {
    if (
      !insuranceAddress ||
      insuranceAddress === ethers.ZeroAddress ||
      !address ||
      !wcProvider ||
      !currentChainId ||
      !ethersProviderRef.current ||
      !isCoreContractsReady
    ) {
      console.error(
        "Blockchain components not ready: check insuranceAddress, current wallet address, wcProvider, currentChainId, ethersProvider, or core contracts status.",
      );
      throw new Error("Blockchain components not ready to pay premium.");
    }

    try {
      console.log("Attemping to cancel SmartInsurante at", insuranceAddress);

      const smartInsuranceIface = new ethers.Interface(SMART_INSURANCE_ABI);

      const cancelData = smartInsuranceIface.encodeFunctionData(
        "cancelPolicy",
        [],
      );

      const cancelTxHash = await (
        wcProvider as IWalletConnectEip1193Provider
      ).request({
        method: "eth_sendTransaction",
        params: [
          {
            from: address,
            to: insuranceAddress,
            data: cancelData,
            chainId: `0x${currentChainId.toString(16)}`,
          },
        ],
      });

      console.log(`CancelPolicy transaction sent. Hash: ${cancelTxHash}`);

      let cancelTimeoutId: NodeJS.Timeout | undefined;
      const cancelTimeoutPromise = new Promise<never>((_resolve, reject) => {
        cancelTimeoutId = setTimeout(() => {
          Alert.alert("Cancel Policy transaction failed", "please try again");
          reject(new Error("Cancel transaction confirmation timed out."));
        }, GLOBAL_TIMEOUT_TX);
      });

      const receipt = await Promise.race([
        ethersProviderRef.current.waitForTransaction(cancelTxHash),
        cancelTimeoutPromise,
      ]);

      clearTimeout(cancelTimeoutId);

      if (!receipt || receipt.status == 0) {
        throw new Error("cancelPolicy transaction failed.");
      }

      console.log("Insurance successfully cancelled");
    } catch (e: any) {
      console.error("Error cancelling smart insurance:", e);
      if (e.reason) console.error("Revert reason:", e.reason);
      if (e.code === "UNPREDICTABLE_GAS_LIMIT") {
        console.error(
          "Potrebbe esserci un errore di revert nel contratto o insufficienza di fondi per il gas.",
        );
      }
      throw e;
    }
  };

  const getWalletTypeOnChain = async (
    walletAddr?: string,
    passedProvider?: JsonRpcProvider | null,
    passedRegistryContract?: Contract | null,
  ) => {
    const provider = passedProvider || ethersProviderRef.current;
    const registryContractRead =
      passedRegistryContract || getUserCompanyRegistryContract();

    if (!provider || !registryContractRead || (!walletAddr && !address)) {
      console.error(
        `ERRORE: getWalletTypeOnChain - Requisiti non pronti. \n` +
          `Provider (passato/ref): ${!!provider} (${provider ? provider.constructor.name : "null"}) \n` +
          `Registry Contract (passato/ref): ${!!registryContractRead} (${registryContractRead ? registryContractRead.constructor.name : "null"}) \n` +
          `Wallet Address (internal): ${!!address} \n` +
          `Wallet Address (param): ${!!walletAddr} \n`,
      );
      return null;
    }
    const targetAddress = walletAddr || address;
    try {
      let infoContractAddress =
        await registryContractRead.getIndividualWalletInfoAddress(
          targetAddress,
        );

      console.log(
        `DEBUG: indirizzo di individualWalletInfo: ${infoContractAddress}`,
      );

      if (infoContractAddress === ethers.ZeroAddress) {
        setIndividualWalletInfoAddress(null);
        individualWalletInfoContractRef.current = null;
        setWalletTypeOnChain(null);
        return null;
      }

      setIndividualWalletInfoAddress(infoContractAddress);
      const individualContractForRead = new Contract(
        infoContractAddress,
        INDIVIDUAL_WALLET_INFO_ABI,
        provider,
      );
      individualWalletInfoContractRef.current = individualContractForRead;

      const contractType = await individualContractForRead.getWalletType();

      let typeString: "user" | "company" | null = null;
      if (contractType == SolidityWalletType.User) {
        typeString = "user";
      } else if (contractType == SolidityWalletType.Company) {
        typeString = "company";
      }

      console.log(
        `DEBUG: tipo di wallet tornato da getWalletTypeOnChain: ${typeString}`,
      );
      setWalletTypeOnChain(typeString);
      return typeString;
    } catch (error: any) {
      console.error(
        "ERRORE GLOBALE in lettura del tipo di wallet da IndividualWalletInfo contract on-chain:",
        error.message || error,
      );
      setWalletTypeOnChain(null);
      setIndividualWalletInfoAddress(null);
      individualWalletInfoContractRef.current = null;
      return null;
    }
  };

  const getSmartInsurancesForWallet = async (
    walletAddr: string,
    status: string,
  ) => {
    const provider = ethersProviderRef.current;
    const registryContractRead = getUserCompanyRegistryContract();
    if (
      !provider ||
      !registryContractRead ||
      (!walletAddr && !address) ||
      !status ||
      currentChainId === null
    ) {
      console.warn(
        "WARN: UserCompanyRegistry Contract or providers not available for insurance lookup.",
      );
      return [];
    }

    const targetAddress = walletAddr || address;

    try {
      const infoAddress =
        await registryContractRead.getIndividualWalletInfoAddress(
          targetAddress,
        );

      if (infoAddress === ethers.ZeroAddress) {
        return [];
      }

      const individualContractForRead = new Contract(
        infoAddress,
        INDIVIDUAL_WALLET_INFO_ABI,
        provider,
      );

      let insuranceAddresses = [];
      switch (status) {
        case "active":
          insuranceAddresses =
            await individualContractForRead.getActiveSmartInsurances();
          break;
        case "closed":
          insuranceAddresses =
            await individualContractForRead.getClosedSmartInsurances();
          break;
        default:
          insuranceAddresses =
            await individualContractForRead.getSmartInsuranceContracts();
          break;
      }

      console.log(status, "insurances for the wallet:", insuranceAddresses);
      return insuranceAddresses;
    } catch (error: any) {
      console.error(
        "ERRORE GLOBALE nel recupero dei contratti SmartInsurance per il wallet:",
        error.message || error,
      );
      return [];
    }
  };

  const getDetailForSmartInsurance = async (
    insuranceAddress: string,
  ): Promise<SmartInsuranceDetails | null> => {
    if (!insuranceAddress || insuranceAddress === ethers.ZeroAddress) {
      console.error("Invalid SmartInsurance address provided.");
      return null;
    }

    const smartInsuranceContract = getSmartInsuranceContract(insuranceAddress);

    if (!smartInsuranceContract) {
      console.error(
        `Failed to get contract instance for SmartInsurance at ${insuranceAddress}. Provider might not be ready.`,
      );
      return null;
    }

    try {
      const userWallet = await smartInsuranceContract.userWallet();
      const companyWallet = await smartInsuranceContract.companyWallet();
      const premiumAmountWei = await smartInsuranceContract.premiumAmount();
      const sensors = await smartInsuranceContract.getAllSensors();
      const geoloc = await smartInsuranceContract.geoloc();
      const payoutAmountWei = await smartInsuranceContract.payoutAmount();
      const tokenAddress = await smartInsuranceContract.tokenAddress();
      const currentStatus = await smartInsuranceContract.currentStatus();

      const premiumAmount = ethers.formatUnits(premiumAmountWei, 18);
      const payoutAmount = ethers.formatUnits(payoutAmountWei, 18);

      const expirationTimestamp =
        await smartInsuranceContract.expirationTimestamp();

      const details: SmartInsuranceDetails = {
        userWallet: userWallet.toString(),
        companyWallet: companyWallet.toString(),
        premiumAmount: premiumAmount,
        sensors: sensors,
        geoloc: geoloc,
        payoutAmount: payoutAmount,
        tokenAddress: tokenAddress.toString(),
        currentStatus: Number(currentStatus),
        expirationTimestamp: Number(expirationTimestamp),
      };

      return details;
    } catch (error: any) {
      console.error(
        `Error fetching details for SmartInsurance ${insuranceAddress}:`,
        error.message || error,
      );
      return null;
    }
  };

  const getMyTokenContract = () => {
    if (!ethersProviderRef.current || currentChainId === null) {
      console.warn(
        "WARN: Provider or Chain ID not ready for MyToken contract.",
      );
      return null;
    }
    const tokenAddress = chainIdToContractAddresses[currentChainId]?.tulToken;
    if (!tokenAddress || tokenAddress === ethers.ZeroAddress) {
      console.warn(
        `WARN: MyToken address not found for chain ID: ${currentChainId} or is zero address.`,
      );
      return null;
    }
    return new Contract(tokenAddress, TUL_TOKEN_ABI, ethersProviderRef.current);
  };

  const getUserCompanyRegistryContract = () => {
    if (!ethersProviderRef.current || currentChainId === null) {
      console.warn(
        "WARN: Provider or Chain ID not ready for UserCompanyRegistry contract.",
      );
      return null;
    }
    const registryAddress =
      chainIdToContractAddresses[currentChainId]?.userCompanyRegistry;
    if (!registryAddress || registryAddress === ethers.ZeroAddress) {
      console.warn(
        `WARN: UserCompanyRegistry address not found for chain ID: ${currentChainId} or is zero address.`,
      );
      return null;
    }
    return new Contract(
      registryAddress,
      USER_COMPANY_REGISTRY_ABI,
      ethersProviderRef.current,
    );
  };

  const getIndividualWalletInfoContract = () => {
    if (
      !individualWalletInfoAddress ||
      individualWalletInfoAddress === ethers.ZeroAddress ||
      !ethersProviderRef.current
    ) {
      console.warn(
        "WARN: IndividualWalletInfo address or provider not ready or is zero address for current user.",
      );
      return null;
    }
    return new Contract(
      individualWalletInfoAddress,
      INDIVIDUAL_WALLET_INFO_ABI,
      ethersProviderRef.current,
    );
  };

  const getSmartInsuranceContract = (contractAddress: string) => {
    const provider = ethersProviderRef.current;
    if (
      !provider ||
      !contractAddress ||
      contractAddress === ethers.ZeroAddress
    ) {
      console.warn(
        "WARN: Cannot get SmartInsurance contract: invalid address or provider not ready.",
      );
      return null;
    }
    return new Contract(contractAddress, SMART_INSURANCE_ABI, provider);
  };

  const submitZoniaRequest = async (
    insuranceAddress: string,
    ko: number,
    ki: number,
    fee: number,
    updateProgress: UpdateProgressCallback,
    chainParams?: ChainParams,
  ): Promise<SensorRequestProgress[]> => {
    if (
      !insuranceAddress ||
      insuranceAddress === ethers.ZeroAddress ||
      !ko ||
      !ki ||
      !fee ||
      !address ||
      !wcProvider ||
      !currentChainId ||
      !ethersProviderRef.current ||
      !isCoreContractsReady
    ) {
      const errorMessage =
        "Blockchain components not ready for Zonia request submission.";
      console.error(errorMessage);
      throw new Error(errorMessage);
    }

    try {
      // Inizializzazioni e interfacce
      const smartInsuranceContractRead = new Contract(
        insuranceAddress,
        SMART_INSURANCE_ABI,
        ethersProviderRef.current,
      );
      const InsuranceIface = new ethers.Interface(SMART_INSURANCE_ABI);

      // @ts-ignore: Assumiamo che getAllSensors ritorni SensorElementFrontend[]
      const sensors: SensorElementFrontend[] =
        await smartInsuranceContractRead.getAllSensors();
      if (sensors.length === 0) {
        throw new Error("No sensors defined in the smart contract.");
      }

      const zoniaTokenAddress =
        chainIdToContractAddresses[currentChainId]?.zoniaToken;
      const zoniaContractAddress =
        chainIdToContractAddresses[currentChainId]?.zoniaContract;
      if (!zoniaTokenAddress || !zoniaContractAddress) {
        throw new Error(
          "Missing Zonia contract addresses for the current chain.",
        );
      }
      const zoniaTokenIface = new ethers.Interface(ZONIA_TOKEN_ABI);
      const gateContractRead = new Contract(
        zoniaContractAddress,
        GATE_ABI,
        ethersProviderRef.current,
      );

      // --- 1. APPROVAZIONE (UNICA) ---
      const totalFee = 10n;

      const approveData = zoniaTokenIface.encodeFunctionData("approve", [
        insuranceAddress,
        totalFee,
      ]);

      const approveTxHash = await (
        wcProvider as IWalletConnectEip1193Provider
      ).request({
        method: "eth_sendTransaction",
        params: [
          {
            from: address,
            to: zoniaTokenAddress,
            data: approveData,
            chainId: `0x${currentChainId.toString(16)}`,
          },
        ],
      });

      const approveReceipt =
        await ethersProviderRef.current.waitForTransaction(approveTxHash);
      if (!approveReceipt || approveReceipt.status === 0) {
        throw new Error("Approve transaction for ZT failed");
      }
      console.log("Approval successful and confirmed.");

      // --- 2. SOTTOMISSIONI MULTIPLE IN PARALLELO e ESTRAZIONE RequestID ---
      const submissionPromises = sensors.map(async (sensor, index) => {
        if (!ethersProviderRef.current) {
          throw new Error("Unable to send submission, provider not ready");
        }

        if (!chainParams) {
          chainParams = { w1: 25, w2: 25, w3: 25, w4: 25 };
        }

        const inputData: InputRequest = {
          query: sensor.query,
          chainParams: chainParams,
          ko: ko,
          ki: ki,
          fee: fee,
        };

        const submitData = InsuranceIface.encodeFunctionData(
          "submitZoniaCheck",
          [inputData, BigInt(index)],
        );

        const submitTxHash = await (
          wcProvider as IWalletConnectEip1193Provider
        ).request({
          method: "eth_sendTransaction",
          params: [
            {
              from: address,
              to: insuranceAddress,
              data: submitData,
              chainId: `0x${currentChainId.toString(16)}`,
            },
          ],
        });

        // @ts-ignore
        const submitReceipt =
          await ethersProviderRef.current.waitForTransaction(submitTxHash);
        if (!submitReceipt || submitReceipt.status === 0) {
          throw new Error(
            `Submit transaction failed for sensor index ${index}.`,
          );
        }

        let requestId: string | undefined;
        for (const log of submitReceipt.logs) {
          try {
            const parsedLog = InsuranceIface.parseLog(log);
            if (parsedLog && parsedLog.name === "ZoniaRequestSubmitted") {
              requestId = parsedLog.args[0];
              break;
            }
          } catch (e) {
            /* ignore */
          }
        }

        if (!requestId) {
          throw new Error(
            `RequestId not found after submission for sensor index ${index}.`,
          );
        }

        // Aggiorna lo stato UI dopo la sottomissione
        updateProgress(requestId, "submitted");

        return {
          sensorIndex: index,
          sensorQuery: sensor.query,
          requestId: requestId,
          status: "submitted" as const,
        };
      });

      const initialResults: SensorRequestProgress[] =
        await Promise.all(submissionPromises);

      // --- 3. ATTESA EVENTI Zonia in Parallelo ---
      const zoniaEventPromises = initialResults.map(
        ({ requestId, sensorIndex, sensorQuery }) => {
          return new Promise<SensorRequestProgress>((resolve, _reject) => {
            const getResultQuery = async (requestIdSub: string) => {
              return await gateContractRead.getResult(requestIdSub);
            };

            const removeAllListeners = (id: string) => {
              gateContractRead.off(
                "RequestSeeded",
                (eventReqId: string) => eventReqId === id,
              );
              gateContractRead.off(
                "RequestReady",
                (eventReqId: string) => eventReqId === id,
              );
              gateContractRead.off(
                "RequestCompleted",
                (eventReqId: string) => eventReqId === id,
              );
              gateContractRead.off(
                "RequestFailed",
                (eventReqId: string) => eventReqId === id,
              );
            };

            const seededListener = async (
              eventRequestId: string,
              seed: string,
            ) => {
              if (eventRequestId.toLowerCase() === requestId.toLowerCase()) {
                updateProgress(requestId, "seeded");
              }
            };

            const readyListener = async (
              eventRequestId: string,
              seed: string,
            ) => {
              if (eventRequestId.toLowerCase() === requestId.toLowerCase()) {
                updateProgress(requestId, "ready");
              }
            };

            const completedListener = async (
              eventRequestId: string,
              result: string,
            ) => {
              if (eventRequestId.toLowerCase() === requestId.toLowerCase()) {
                updateProgress(requestId, "completed", result);
                removeAllListeners(requestId);
                resolve({
                  requestId,
                  sensorIndex,
                  sensorQuery,
                  result,
                  status: "completed",
                });
              }
            };

            const failedListener = async (
              eventRequestId: string,
              result: string,
            ) => {
              if (eventRequestId.toLowerCase() === requestId.toLowerCase()) {
                updateProgress(requestId, "failed", result);
                removeAllListeners(requestId);
                resolve({
                  requestId,
                  sensorIndex,
                  sensorQuery,
                  result,
                  status: "failed",
                });
              }
            };

            gateContractRead.on("RequestSeeded", seededListener);
            gateContractRead.on("RequestReady", readyListener);
            gateContractRead.on("RequestCompleted", completedListener);
            gateContractRead.on("RequestFailed", failedListener);
          });
        },
      );

      const finalZoniaResults: SensorRequestProgress[] =
        await Promise.all(zoniaEventPromises);

      // --- 4. VERIFICA CRITICA e CHECK ON CHAIN ---
      const allZoniaSuccessful = finalZoniaResults.every(
        (r) => r.status === "completed",
      );

      if (!allZoniaSuccessful) {
        console.warn(
          "One or more Zonia requests failed. Skipping on-chain check.",
        );
        // Ritorna i risultati che includono i fallimenti Zonia
        return finalZoniaResults;
      }

      console.log(
        "All Zonia requests completed successfully. Proceeding with on-chain check.",
      );

      // Iniziamo la fase di check on chain (solo se tutti i Zonia requests sono 'completed')
      const checkPromises = finalZoniaResults.map(async (result) => {
        if (!ethersProviderRef.current) {
          throw new Error("checkPromises failed, provider not ready.");
        }

        const checkData = InsuranceIface.encodeFunctionData("checkZoniaData", [
          result.requestId,
          BigInt(result.sensorIndex),
        ]);

        const checkDataTxHash = await (
          wcProvider as IWalletConnectEip1193Provider
        ).request({
          method: "eth_sendTransaction",
          params: [
            {
              from: address,
              to: insuranceAddress,
              data: checkData,
              chainId: `0x${currentChainId.toString(16)}`,
            },
          ],
        });

        // @ts-ignore
        const checkDataReceipt =
          await ethersProviderRef.current.waitForTransaction(checkDataTxHash);

        if (!checkDataReceipt || checkDataReceipt.status === 0) {
          return {
            ...result,
            status: "failed" as const, // Forziamo lo stato finale a 'failed' per la UI
            result: "Check On-Chain Failed: Transaction Reverted", // Aggiorniamo il risultato
          };
        }

        // Check on-chain eseguito con successo.
        return {
          ...result,
          finalCheckSuccess: true,
        };
      });

      const finalCheckResults = await Promise.all(checkPromises);

      // Questo è il punto in cui dovresti aggiornare lo stato di 'canRequestPayout' nel tuo AuthContext
      // const smartInsuranceContract = getSmartInsuranceContract(insuranceAddress);
      // setCanRequestPayout(smartInsuranceContract != null ? await smartInsuranceContract.allConditionsSatisfied() : false);

      return finalCheckResults;
    } catch (error: any) {
      throw error;
    }
  };

  const clearZoniaRequestState = () => {
    setZoniaRequestState(null);
  };

  const clearDeployStatus = () => {
    setDeploySmartInsuranceState("");
  };

  const batchUpdateExpiredPolicies = async (policyAddresses: string[]) => {
    if (
      !address ||
      !wcProvider ||
      !individualWalletInfoAddress ||
      !currentChainId ||
      !ethersProviderRef.current
    ) {
      throw new Error("Blockchain components not ready to update policies.");
    }

    const individualWalletInfoIface = new ethers.Interface(
      INDIVIDUAL_WALLET_INFO_ABI,
    );

    const txData = individualWalletInfoIface.encodeFunctionData(
      "batchUpdateExpiredPolicies",
      [policyAddresses],
    );

    console.log("txData:", individualWalletInfoAddress);
    try {
      const txHash = await (
        wcProvider as IWalletConnectEip1193Provider
      ).request({
        method: "eth_sendTransaction",
        params: [
          {
            from: address,
            to: individualWalletInfoAddress,
            data: txData,
            chainId: `0x${currentChainId.toString(16)}`,
          },
        ],
      });

      let checkExpTimeoutId: NodeJS.Timeout | undefined;
      const checkExpTimeoutPromise = new Promise<never>((_resolve, reject) => {
        checkExpTimeoutId = setTimeout(
          () => {
            Alert.alert(
              "Check Expirations transaction failed",
              "please try again",
            );
            reject(
              new Error(
                "Check Expirations transaction confirmation timed out.",
              ),
            );
          },
          GLOBAL_TIMEOUT_TX + 10 * 1000,
        );
      });

      const receipt = await Promise.race([
        ethersProviderRef.current.waitForTransaction(txHash),
        checkExpTimeoutPromise,
      ]);

      clearTimeout(checkExpTimeoutId);

      if (!receipt || receipt.status === 0) {
        throw new Error("Transaction failed on-chain.");
      }

      console.log(
        `Successfully updated expired policies. Transaction hash: ${txHash}`,
      );
    } catch (error: any) {
      console.error("Error during batchUpdateExpiredPolicies:", error);
      throw error;
    }
  };

  const contextValue: AuthContextType = {
    selectedAppRole,
    selectAppRole,
    walletConnected,
    connectWallet,
    disconnectWallet,
    clearAllData,
    walletAddress: address,
    provider: ethersProviderRef.current || undefined,
    walletTypeOnChain,
    individualWalletInfoAddress,
    isCoreContractsReady,
    currentChainId,
    createSmartInsurance,
    registerWalletOnChain,
    getWalletTypeOnChain,
    getSmartInsurancesForWallet,
    getDetailForSmartInsurance,
    getMyTokenContract,
    getUserCompanyRegistryContract,
    getIndividualWalletInfoContract,
    getSmartInsuranceContract,
    paySmartInsurancePremium,
    submitZoniaRequest,
    paySmartInsurancePayout,
    zoniaRequestState,
    clearZoniaRequestState,
    cancelPolicy,
    deploySmartInsuranceState,
    clearDeployStatus,
    canRequestPayout,
    batchUpdateExpiredPolicies,
  };

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
