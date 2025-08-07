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

const GLOBAL_TIMEOUT_TX = 20000;

interface IWalletConnectEip1193Provider extends EIP1193Provider {
  request: (args: { method: string; params?: any[] }) => Promise<any>;
}

interface SmartInsuranceDetails {
  userWallet: string;
  companyWallet: string;
  premiumAmount: string;
  query: string;
  sensor: string;
  target_value: string;
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
    query: string,
    sensor: string,
    target_value: bigint,
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
    chainParams?: ChainParams,
  ) => Promise<string | undefined>;
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
}

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
      await close();
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
    query: string,
    sensor: string,
    target_value: bigint,
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

      interface InsuranceInitParams {
        userWallet: string;
        companyWallet: string;
        premiumAmount: ethers.BigNumberish;
        query: string;
        sensor: string;
        target_value: ethers.BigNumberish;
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
        query: query,
        sensor: sensor,
        target_value: target_value,
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
      const query = await smartInsuranceContract.query();
      const sensor = await smartInsuranceContract.sensor();
      const target_value = await smartInsuranceContract.target_value();
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
        query: query,
        sensor: sensor,
        target_value: target_value,
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
    chainParams?: ChainParams,
  ): Promise<string | undefined> => {
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
      const smartInsuranceContractRead = new Contract(
        insuranceAddress,
        SMART_INSURANCE_ABI,
        ethersProviderRef.current,
      );
      const query = await smartInsuranceContractRead.query();

      const zoniaTokenContract = new Contract(
        chainIdToContractAddresses[currentChainId]?.zoniaToken,
        ZONIA_TOKEN_ABI,
        ethersProviderRef.current,
      );

      console.log(
        "zonia token balance for wallet:",
        ethers.formatUnits(await zoniaTokenContract.balanceOf(address), 18),
      );

      const zoniaTokenIface = new ethers.Interface(ZONIA_TOKEN_ABI);

      console.log(
        `Sending approval transaction for Token ${chainIdToContractAddresses[currentChainId].zoniaToken} to spend ${ethers.formatEther(fee)} ZoniaToken...`,
      );

      const approveData = zoniaTokenIface.encodeFunctionData("approve", [
        chainIdToContractAddresses[currentChainId].zoniaContract, //insuranceAddress
        10n,
      ]);

      const approveTxHash = await (
        wcProvider as IWalletConnectEip1193Provider
      ).request({
        method: "eth_sendTransaction",
        params: [
          {
            from: address,
            to: chainIdToContractAddresses[currentChainId].zoniaToken,
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
        throw new Error("Approve transaction for ZT failed");
      }
      console.log("Approval successful and confirmed.");

      /*
      const InsuranceIface = new ethers.Interface(SMART_INSURANCE_ABI);

      const submitData = InsuranceIface.encodeFunctionData(
        "checkZoniaData",
        [1, 1, 10],
      );

      console.log("sending submitRequest zonia");

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

      console.log("submitRequest transaction sent.", submitTxHash);
      let requestId: string = "";

      const submitReceipt =
        await ethersProviderRef.current.waitForTransaction(submitTxHash);

      if (!submitReceipt || submitReceipt.status == 0) {
        throw new Error("submitRequest transaction error.");
      }

      console.log("submitRequest transaction confirmed.");

      for (const log of submitReceipt.logs) {
        try {
          const parsedLog = InsuranceIface.parseLog(log);
          if (parsedLog && parsedLog.name === "ZoniaRequestSubmitted") {
            requestId = parsedLog.args[0];
            console.log(
              "Evento ZoniaRequestSubmitted trovato. RequestId:",
              requestId,
            );
            setZoniaRequestState("submitted");
            break;
          }
        } catch (e) {
          setZoniaRequestState("failed");
          return "Request Id not found";
        }
      }

      if (!requestId) {
        setZoniaRequestState("failed");
        return "Request Id not found";
      }

      //*/

      ///*
      const GateIface = new ethers.Interface(GATE_ABI);

      if (!chainParams) {
        chainParams = { w1: 25, w2: 25, w3: 25, w4: 25 };
      }

      const inputData: InputRequest = {
        query: '{ "topic" : "zonia:PriceEthereum" }', //query
        chainParams: chainParams,
        ko: ko,
        ki: ki,
        fee: fee,
      };

      const submitRequestData = GateIface.encodeFunctionData("submitRequest", [
        inputData,
      ]);

      console.log("input di submitRequest:", inputData);

      let submitHash: string;
      try {
        submitHash = await (
          wcProvider as IWalletConnectEip1193Provider
        ).request({
          method: "eth_sendTransaction",
          params: [
            {
              from: address,
              to: chainIdToContractAddresses[currentChainId]?.zoniaContract,
              data: submitRequestData,
              chainId: `0x${currentChainId.toString(16)}`,
            },
          ],
        });
        console.log("Zonia transaction sent. Hash", submitHash);
      } catch (providerError: any) {
        console.error("\n--- ERRORE DURANTE INVIO TRANSAZIONE AL PROVIDER ---");
        console.error("Tipo di errore:", providerError.name || "Sconosciuto");
        console.error("Messaggio:", providerError.message);
        if (providerError.code)
          console.error("Codice Ethers/RPC:", providerError.code);
        if (providerError.data)
          console.error("Dati errore (se presenti):", providerError.data);
        console.error(
          "Dettagli completi dell'errore dal provider:",
          providerError,
        );
        console.error("---------------------------------------------------\n");
        throw new Error(
          `Failed to send transaction to provider: ${providerError.message}`,
        );
      }

      let submitTimeoutId: NodeJS.Timeout | undefined;
      const submitTimeoutPromise = new Promise<never>((_resolve, reject) => {
        submitTimeoutId = setTimeout(() => {
          Alert.alert("Submit transaction failed", "please try again");
          reject(new Error("Submit transaction confirmation timed out."));
        }, GLOBAL_TIMEOUT_TX);
      });

      const receipt = await Promise.race([
        ethersProviderRef.current.waitForTransaction(submitHash),
        submitTimeoutPromise,
      ]);

      clearTimeout(submitTimeoutId);

      if (!receipt || receipt.status == 0) {
        console.error("\n--- ERRORE: TRANSAZIONE ZONIA REVERTITA ON-CHAIN ---");
        console.error("Hash:", submitHash);
        console.error("Stato:", receipt ? receipt.status : "N/A");
        if (receipt && receipt.logs) {
          console.error("Log:", receipt.logs);
        }
        throw new Error(
          "Zonia submission transaction failed: transaction reverted on-chain.",
        );
      }

      let requestId: string | undefined;

      for (const log of receipt.logs) {
        try {
          const parsedLog = GateIface.parseLog(log);
          if (
            parsedLog &&
            parsedLog.name === "RequestSubmitted" &&
            parsedLog.args.requestId
          ) {
            requestId = parsedLog.args.requestId;
            console.log(
              `RequestSubmitted event found. RequestId: ${requestId}`,
            );
            setZoniaRequestState("submitted");
            break;
          }
        } catch (e) {
          console.error("ERROR parsing log in submitZoniaRequest:", e);
        }
      }

      if (!requestId) {
        console.error("\n--- ERRORE: RequestId NON TROVATO ---");
        setZoniaRequestState("failed");
        return "Request Id not found";
      }

      //*/

      const gateContractRead = new Contract(
        chainIdToContractAddresses[currentChainId]?.zoniaContract,
        GATE_ABI,
        ethersProviderRef.current,
      );

      const sleep = (ms: number): Promise<void> => {
        return new Promise((resolve) => setTimeout(resolve, ms));
      };

      const getResultQuery = async (requestIdSub: string) => {
        return await gateContractRead.getResult(requestIdSub);
      };

      const finalResult = await new Promise<string>((resolve, reject) => {
        const seededListener = async (
          eventRequestId: string,
          seed: string,
          pubKey: string,
          submitter: string,
        ) => {
          if (eventRequestId.toLowerCase() === requestId?.toLowerCase()) {
            console.log(
              `EVENT RequestSeeded event found for requestId ${requestId}. submitter: ${submitter} \nseed: ${seed}`,
            );

            setZoniaRequestState("seeded");
            await gateContractRead.off("RequestSeeded", seededListener);
            // resolve(seed);
          }
        };

        const readyListener = async (eventRequestId: string, seed: string) => {
          if (eventRequestId.toLowerCase() === requestId?.toLowerCase()) {
            console.log(
              `EVENT RequestReady event found for requestId ${requestId}`,
            );

            setZoniaRequestState("ready");
            await gateContractRead.off("RequestReady", readyListener);
            //resolve(seed);
          }
        };

        const failedListener = async (
          eventRequestId: string,
          result: string,
        ) => {
          if (eventRequestId.toLowerCase() === requestId?.toLowerCase()) {
            console.log(
              `EVENT RequestFailed event found for requestId ${eventRequestId}. Reason: ${result}`,
            );

            setZoniaRequestState("failed");
            await gateContractRead.off("RequestCompleted", completedListener);
            console.log(
              `FAILED RequestFailed for requestId ${requestId}: ${result}`,
            );
            const resultAttemp = await getResultQuery(requestId);
            console.log("risultato della Request:", resultAttemp);
            resolve(result);
          }
        };

        const completedListener = async (
          eventRequestId: string,
          result: string,
        ) => {
          if (eventRequestId.toLowerCase() === requestId?.toLowerCase()) {
            console.log(
              `EVENT RequestCompleted event found for requestId ${eventRequestId}. Result: ${result}`,
            );

            setZoniaRequestState("completed");
            await gateContractRead.off("RequestFailed", failedListener);
            console.log(
              "DEBUG completed getResult",
              await getResultQuery(eventRequestId),
            );
            resolve(result);
          }
        };

        gateContractRead.on("RequestSeeded", seededListener);
        gateContractRead.on("RequestReady", readyListener);
        gateContractRead.on("RequestCompleted", completedListener);
        gateContractRead.on("RequestFailed", failedListener);
      });
      console.log("final result", finalResult);

      // iniziamo la fase di check on chain del result
      if (zoniaRequestState === "failed") {
        return finalResult;
      }
      console.log("checking on chain");

      const InsuranceIface = new ethers.Interface(SMART_INSURANCE_ABI);
      const checkData = InsuranceIface.encodeFunctionData("checkZoniaData", [
        requestId,
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

      let checkDataTimeoutId: NodeJS.Timeout | undefined;
      const checkDataTimeoutPromise = new Promise<never>((_resolve, reject) => {
        checkDataTimeoutId = setTimeout(() => {
          Alert.alert("Check Data transaction failed", "please try again");
          reject(new Error("Check Data transaction confirmation timed out."));
        }, GLOBAL_TIMEOUT_TX);
      });

      const checkDataReceipt = await Promise.race([
        ethersProviderRef.current.waitForTransaction(checkDataTxHash),
        checkDataTimeoutPromise,
      ]);

      clearTimeout(checkDataTimeoutId);

      if (!checkDataReceipt || checkDataReceipt.status == 0) {
        throw new Error(
          "Zonia submission transaction failed: transaction reverted on-chain.",
        );
      }
      const smartInsuranceContract =
        getSmartInsuranceContract(insuranceAddress);

      setCanRequestPayout(
        smartInsuranceContract != null
          ? await smartInsuranceContract.conditionsSatisfied()
          : false,
      );

      return finalResult;
    } catch (error: any) {
      console.error("\n--- ERRORE GENERALE IN SUBMIT ZONIA REQUEST ---");
      console.error("Messaggio d'errore:", error.message);
      if (error.stack) console.error("Stack trace:", error.stack);
      console.error("Dettagli completi dell'oggetto errore:", error);
      console.error("---------------------------------------------------\n");
      throw error;
    }
  };

  const clearZoniaRequestState = () => {
    setZoniaRequestState(null);
  };

  const clearDeployStatus = () => {
    setDeploySmartInsuranceState("");
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
