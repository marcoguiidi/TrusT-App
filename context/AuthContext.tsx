import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  ReactNode,
  useRef,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useWalletConnectModal } from "@walletconnect/modal-react-native";
import { Contract, JsonRpcProvider, ethers, ContractFactory } from "ethers";
import { EIP1193Provider } from "@walletconnect/universal-provider";

import {
  USER_COMPANY_REGISTRY_ABI,
  INDIVIDUAL_WALLET_INFO_ABI,
  SMART_INSURANCE_ABI,
  TUL_TOKEN_ABI,
  SolidityWalletType,
} from "../constants/abis";

import SmartInsuranceArtifact from "../smart-contracts/artifacts/contracts/SmartInsurance.sol/SmartInsurance.json";

import { chainIdToContractAddresses } from "../constants/contractsAddresses";

import { providerMetadata } from "../constants/walletConnectConfig";

interface IWalletConnectEip1193Provider extends EIP1193Provider {
  request: (args: { method: string; params?: any[] }) => Promise<any>;
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
  // Ho aggiornato la firma qui per accettare provider e registryContract esplicitamente.
  getWalletTypeOnChain: (
    walletAddr?: string,
    provider?: JsonRpcProvider | null, // Rendi opzionale se non sei in initEthers
    registryContract?: Contract | null, // Rendi opzionale se non sei in initEthers
  ) => Promise<"user" | "company" | null>;
  createSmartInsurance: (
    insuredWalletAddress: string, // Indirizzo dell'utente assicurato
    insuranceDescription: string,
    premiumAmount: string,
    payoutAmount: string,
    tokenAddress: string,
  ) => Promise<string>;
  addSmartInsuranceToWallet: (
    insuranceContractAddress: string,
    insuredWalletAddress: string,
  ) => Promise<void>;
  getSmartInsurancesForWallet: (walletAddr?: string) => Promise<string[]>;
  getMyTokenContract: () => Contract | null;
  getUserCompanyRegistryContract: () => Contract | null;
  getIndividualWalletInfoContract: () => Contract | null;
  getSmartInsuranceContract: (address: string) => Contract | null;
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
      console.log("initEthers iniziato");
      // Resetta tutti gli stati e riferimenti all'inizio
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
      console.log("Wallet connesso. Inizializzo provider e contratti.");

      const ngrokUrl = providerMetadata.url;
      if (!ngrokUrl) {
        console.error(
          "ERRORE: URL di ngrok non configurato in providerMetadata.url. Impossibile procedere.",
        );
        setIsCoreContractsReady(false);
        return;
      }
      console.log(`URL di ngrok rilevato: ${ngrokUrl}`);

      let localProvider: JsonRpcProvider | null = null;
      let localChainId: number | null = null;
      let localRegistryContract: Contract | null = null;

      try {
        console.log("Inizializzazione JsonRpcProvider con URL ngrok...");
        localProvider = new JsonRpcProvider(ngrokUrl); // Usa una variabile locale
        ethersProviderRef.current = localProvider; // Aggiorna anche il ref per le altre funzioni
        console.log(
          "JsonRpcProvider inizializzato.",
          ethersProviderRef.current,
        );

        const network = await localProvider.getNetwork();
        localChainId = Number(network.chainId); // Usa una variabile locale
        setCurrentChainId(localChainId); // Aggiorna lo stato per React e altri componenti
        console.log(
          `Provider Network: ${network.name} (Chain ID: ${localChainId})`,
        );

        const currentContractAddresses =
          chainIdToContractAddresses[localChainId]; // Usa la variabile locale per il chainId

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
          console.log("TulToken Contract initialized for reads.");
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
          console.log(
            "UserCompanyRegistry Contract initialized and isCoreContractsReady set to true.",
          );
        } else {
          console.warn(
            "UserCompanyRegistry address not configured or is zero address. Cannot interact with central registry.",
          );
          setIsCoreContractsReady(false);
          userCompanyRegistryContractRef.current = null;
          // Se il registry non è pronto, non possiamo procedere con la verifica del tipo di wallet
          return;
        }

        // --- Chiamata a getWalletTypeOnChain con le dipendenze locali GIA' PRONTE ---
        // NON c'è più bisogno del while loop con setTimeout qui,
        // perché stiamo passando le variabili locali 'localProvider' e 'localRegistryContract'
        // che sono garantite essere state inizializzate nelle righe precedenti.
        if (localRegistryContract && localProvider) {
          // Doppio controllo, ma le variabili dovrebbero essere pronte
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
              localProvider, // Usa il provider locale qui
            );
            individualWalletInfoContractRef.current = individualContract;
            console.log(
              `IndividualWalletInfo found for ${address} at: ${infoContractAddress}`,
            );

            // Passa esplicitamente localProvider e localRegistryContract (ora garantiti)
            const typeOnChain = await getWalletTypeOnChain(
              address,
              localProvider,
              localRegistryContract,
            );
            // *** NUOVA RIGA: Imposta selectedAppRole in base a walletTypeOnChain ***
            if (typeOnChain) {
              setSelectedAppRole(typeOnChain);
              // Salva anche in AsyncStorage per persistenza del ruolo selezionato dall'app
              await AsyncStorage.setItem("selectedAppRole", typeOnChain);
            }
          } else {
            setIndividualWalletInfoAddress(null);
            individualWalletInfoContractRef.current = null;
            setWalletTypeOnChain(null);
            console.log(`No IndividualWalletInfo found for ${address}.`);
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
  }, [isConnected, address, wcProvider]); // Dipendenze per triggerare l'inizializzazione

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
      if (wcProvider && wcProvider.disconnect) {
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
      console.log("All local and in-memory data cleared.");
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
      !isCoreContractsReady || // Dipende dallo stato, che sarà aggiornato dal useEffect
      !USER_COMPANY_REGISTRY_ADDRESS_CURRENT ||
      currentChainId === null || // Dipende dallo stato
      !ethersProviderRef.current // Dipende dal ref
    ) {
      console.error(
        "Blockchain components not ready for transaction. Check wallet address, wcProvider, currentChainId, or ethersProvider.",
      );
      throw new Error("Blockchain components not ready.");
    }

    try {
      console.log(
        `DEBUG: Tentativo di registrazione completa per l'indirizzo: ${address} come ${type}.`,
      );

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

        console.log(
          `DEBUG: Chiamando wcProvider.request() per registerAndCreateIndividualWalletInfo...`,
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
        console.log(
          `DEBUG: Transazione di creazione inviata. Hash: ${createTxHash}`,
        );
        await ethersProviderRef.current.waitForTransaction(createTxHash);
        console.log(
          `DEBUG: IndividualWalletInfo creato e proprietà trasferita con successo tramite Registry.`,
        );

        infoAddress =
          await registryContractRead.getIndividualWalletInfoAddress(address);
        if (!infoAddress || infoAddress === ethers.ZeroAddress) {
          throw new Error(
            "Errore: Indirizzo IndividualWalletInfo non recuperato dopo la creazione.",
          );
        }
        console.log(`DEBUG: Nuovo IndividualWalletInfo a: ${infoAddress}`);
      } else {
        console.log(
          `DEBUG: IndividualWalletInfo esistente per ${address} trovato a: ${infoAddress}.`,
        );
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

      console.log(
        `DEBUG: Tipo di wallet attuale sul contratto: ${currentTypeOnContract} (None=0, User=1, Company=2). Tipo da impostare: ${solidityType}.`,
      );

      if (currentTypeOnContract == solidityType) {
        console.log(
          `DEBUG: Il tipo di wallet ${type} è già impostato. Nessuna azione necessaria.`,
        );
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
        await ethersProviderRef.current.waitForTransaction(setTypeTxHash);
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

  const registerSmartInsuranceForUser = async (
    targetWalletAddress: string, // L'indirizzo del wallet dell'utente (non il IWIC address)
    insuranceContractAddress: string,
  ) => {
    if (
      !targetWalletAddress ||
      targetWalletAddress === ethers.ZeroAddress ||
      !insuranceContractAddress ||
      insuranceContractAddress === ethers.ZeroAddress ||
      !address ||
      !wcProvider ||
      !currentChainId ||
      !ethersProviderRef.current ||
      !isCoreContractsReady ||
      !getUserCompanyRegistryContract()
    ) {
      console.error(
        "Blockchain components not ready to register insurance for user.",
      );
      throw new Error("Blockchain components not ready.");
    }

    const registryContract = getUserCompanyRegistryContract();
    const companySigner = await ethersProviderRef.current.getSigner(address);

    if (!registryContract || !companySigner) {
      throw new Error("Registry contract or signer not available.");
    }

    try {
      console.log(
        `Company ${address} attempting to register SmartInsurance ${insuranceContractAddress} for user ${targetWalletAddress}...`,
      );

      // 1. Ottieni l'indirizzo dell'IndividualWalletInfo dell'utente assicurato tramite il Registry
      const userIndividualWalletInfoAddress =
        await registryContract.getIndividualWalletInfoAddress(
          targetWalletAddress,
        );

      if (userIndividualWalletInfoAddress === ethers.ZeroAddress) {
        throw new Error(
          `IndividualWalletInfo not found for user: ${targetWalletAddress}.`,
        );
      }

      // 2. Crea un'istanza del contratto IndividualWalletInfo dell'utente assicurato con il signer della compagnia
      // Questo è possibile perché la compagnia (se l'initialOwner del IWIC è il Registry) è un InsuranceManager.
      const userIndividualWalletInfoContract = new Contract(
        userIndividualWalletInfoAddress,
        INDIVIDUAL_WALLET_INFO_ABI,
        companySigner,
      );

      console.log(
        `Calling addSmartInsuranceContract on IWIC ${userIndividualWalletInfoAddress} for user ${targetWalletAddress}...`,
      );

      // 3. Chiama addSmartInsuranceContract sull'IndividualWalletInfo dell'utente assicurato
      const tx =
        await userIndividualWalletInfoContract.addSmartInsuranceContract(
          insuranceContractAddress,
        );
      console.log(
        `Transaction to add insurance for user sent. Hash: ${tx.hash}`,
      );
      await tx.wait(); // Aspetta la conferma della transazione

      console.log(
        `SmartInsurance ${insuranceContractAddress} successfully added to IndividualWalletInfo of user ${targetWalletAddress}.`,
      );
    } catch (e: any) {
      console.error(
        `Error registering insurance ${insuranceContractAddress} for user ${targetWalletAddress}:`,
        e,
      );
      throw e;
    }
  };

  const createSmartInsurance = async (
    insuredWalletAddress: string,
    insuranceDescription: string,
    premiumAmount: string,
    payoutAmount: string,
    tokenAddress: string,
  ): Promise<string> => {
    if (
      !insuredWalletAddress ||
      insuredWalletAddress === ethers.ZeroAddress ||
      !address ||
      !wcProvider ||
      !currentChainId ||
      !ethersProviderRef.current ||
      !isCoreContractsReady
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

    const companyWalletAddress = address; // L'indirizzo del wallet connesso è la compagnia

    try {
      console.log("Inizio creazione SmartInsurance...");

      const smartInsuranceFactory = new ContractFactory(
        SmartInsuranceArtifact.abi,
        SmartInsuranceArtifact.bytecode,
        await ethersProviderRef.current.getSigner(companyWalletAddress),
      );

      console.log("Deploying SmartInsurance contract...");
      const smartInsuranceContract = await smartInsuranceFactory.deploy(
        insuredWalletAddress,
        companyWalletAddress,
        premiumAmountWei,
        insuranceDescription,
        payoutAmountWei,
        tokenAddress,
      );

      console.log(
        "Transazione di deploy SmartInsurance inviata. Hash:",
        smartInsuranceContract.deploymentTransaction()?.hash,
      );
      await smartInsuranceContract.waitForDeployment();
      const deployedAddress = await smartInsuranceContract.getAddress();
      console.log("SmartInsurance contratto deployato a:", deployedAddress);

      // 2. Aggiungi la SmartInsurance all'individualWalletInfo dell'utente corrente (company)
      console.log(
        "Aggiungo la SmartInsurance all'individualWalletInfo del creatore (compagnia)...",
      );
      await addSmartInsuranceToWallet(deployedAddress); // Questa aggiunge al wallet connesso
      console.log("SmartInsurance aggiunta al wallet della compagnia.");

      // 3. Aggiungi la SmartInsurance all'individualWalletInfo dell'utente assicurato
      if (
        insuredWalletAddress.toLowerCase() !==
        companyWalletAddress.toLowerCase()
      ) {
        console.log(
          "Aggiungo la SmartInsurance all'individualWalletInfo dell'utente assicurato...",
        );
        await registerSmartInsuranceForUser(
          insuredWalletAddress,
          deployedAddress,
        );
        console.log(
          "SmartInsurance aggiunta al wallet dell'utente assicurato.",
        );
      } else {
        console.log(
          "L'utente assicurato è lo stesso della compagnia, polizza già aggiunta.",
        );
      }

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

  const addSmartInsuranceToWallet = async (
    insuranceContractAddress: string,
  ) => {
    if (
      !individualWalletInfoAddress ||
      individualWalletInfoAddress === ethers.ZeroAddress ||
      !address ||
      !wcProvider ||
      !currentChainId ||
      !ethersProviderRef.current
    ) {
      console.error(
        "IndividualWalletInfo address, wallet address, wcProvider, or currentChainId not available to add insurance.",
      );
      throw new Error("Blockchain components not ready.");
    }
    try {
      console.log(
        `DEBUG: Aggiunta del contratto SmartInsurance ${insuranceContractAddress} tramite wcProvider.request()...`,
      );

      const individualIface = new ethers.Interface(INDIVIDUAL_WALLET_INFO_ABI);
      const addInsuranceData = individualIface.encodeFunctionData(
        "addSmartInsuranceContract",
        [insuranceContractAddress],
      );

      const addTxHash = await (
        wcProvider as IWalletConnectEip1193Provider
      ).request({
        method: "eth_sendTransaction",
        params: [
          {
            from: address,
            to: individualWalletInfoAddress,
            data: addInsuranceData,
            chainId: `0x${currentChainId.toString(16)}`,
          },
        ],
      });
      console.log(
        `DEBUG: Transazione addSmartInsuranceContract inviata. Hash: ${addTxHash}`,
      );
      await ethersProviderRef.current.waitForTransaction(addTxHash);
      console.log(
        `DEBUG: Contratto SmartInsurance ${insuranceContractAddress} aggiunto con successo!`,
      );
    } catch (error: any) {
      console.error(
        "ERRORE GLOBALE nell'aggiunta del contratto SmartInsurance:",
        error.message || error,
      );
      throw error;
    }
  };

  // Ho modificato la firma di questa funzione per accettare provider e registryContract come argomenti
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
        provider, // Usa il provider che è stato determinato come valido
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

  const getSmartInsurancesForWallet = async (walletAddr?: string) => {
    const provider = ethersProviderRef.current;
    const registryContractRead = getUserCompanyRegistryContract();
    if (
      !provider ||
      !registryContractRead ||
      (!walletAddr && !address) ||
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

      const insuranceAddresses =
        await individualContractForRead.getSmartInsuranceContracts();
      console.log("insurances for the wallet:", insuranceAddresses);
      return insuranceAddresses;
    } catch (error: any) {
      console.error(
        "ERRORE GLOBALE nel recupero dei contratti SmartInsurance per il wallet:",
        error.message || error,
      );
      return [];
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
    addSmartInsuranceToWallet,
    getSmartInsurancesForWallet,
    getMyTokenContract,
    getUserCompanyRegistryContract,
    getIndividualWalletInfoContract,
    getSmartInsuranceContract,
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
