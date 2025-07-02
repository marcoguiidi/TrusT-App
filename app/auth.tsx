// your-expo-project/app/auth.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Button,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { Redirect, router } from "expo-router";

const AuthScreen = () => {
  const {
    connectWallet,
    walletConnected,
    selectedAppRole,
    walletAddress,
    walletTypeOnChain,
    registerWalletOnChain,
    getWalletTypeOnChain,
    isCoreContractsReady,
    disconnectWallet,
  } = useAuth();

  const [loadingContractOps, setLoadingContractOps] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleAuthFlow = async () => {
      setErrorMessage(null);

      console.log("sto egesuendo il flusso di autenticazione");
      if (walletConnected && selectedAppRole && walletAddress) {
        if (!isCoreContractsReady) {
          setErrorMessage(
            "Errore: Impossibile connettersi ai contratti blockchain centrali. Controlla indirizzi e rete.",
          );
          return;
        }

        setLoadingContractOps(false);
        try {
          // 1. Tenta di leggere il tipo di wallet esistente on-chain (questo controllerà anche l'esistenza del contratto IndividualWalletInfo)
          let currentWalletType = walletTypeOnChain;
          if (currentWalletType === null) {
            currentWalletType = await getWalletTypeOnChain(walletAddress);
          }

          if (currentWalletType === null) {
            console.log(
              "Nessun tipo di wallet on-chain esistente trovato. Registrazione del nuovo tipo on-chain...",
            );
            await registerWalletOnChain(selectedAppRole);
          } else {
            console.log("trovato wallet on chain di tipo: ", currentWalletType);
            if (currentWalletType === "user") {
              router.replace("/dashboard");
            } else if (currentWalletType === "company") {
              router.replace("/dashboard");
            }
            return;
          }

          // Se arriviamo qui, il tipo di wallet on-chain corrisponde, o è stato appena registrato,
          // e non è stata richiesta una risoluzione del conflitto che richiedesse un riavvio.
          if (selectedAppRole === "user") {
            router.replace("/dashboard");
          } else if (selectedAppRole === "company") {
            router.replace("/dashboard");
          }
        } catch (error: any) {
          console.error("Errore durante le operazioni del contratto:", error);
          if (
            error.message &&
            error.message.includes("Wallet type already set")
          ) {
            setErrorMessage(
              "Il tipo di wallet per questo account è già impostato sul suo contratto individuale.",
            );
          } else {
            setErrorMessage(
              "Si è verificato un problema durante l'interazione con la blockchain. Si prega di controllare la console.",
            );
          }
        } finally {
          setLoadingContractOps(false);
        }
      }
    };

    handleAuthFlow();
  }, [
    walletConnected,
    selectedAppRole,
    walletAddress,
    walletTypeOnChain,
    registerWalletOnChain,
    getWalletTypeOnChain,
    isCoreContractsReady,
    disconnectWallet,
  ]);

  if (selectedAppRole === null) {
    console.warn("Redirect di auth");
    return <Redirect href="/" />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Accedi con MetaMask</Text>
      {!walletConnected ? (
        <View style={styles.buttonContainer}>
          <Button title="Connetti Wallet" onPress={connectWallet} />
        </View>
      ) : (
        <View>
          <ActivityIndicator size="large" color="#111111" />
          <Text style={styles.connectingText}>
            {loadingContractOps
              ? "Connesso, interazione con il contratto..."
              : "Wallet connesso, reindirizzamento..."}
          </Text>
          {errorMessage && (
            <Text style={styles.errorMessage}>{errorMessage}</Text>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  title: {
    fontSize: 24,
    marginBottom: 40,
    fontWeight: "bold",
  },
  buttonContainer: {
    width: "80%",
  },
  connectingText: {
    marginTop: 20,
    fontSize: 16,
    color: "#555",
    textAlign: "center",
  },
  errorMessage: {
    marginTop: 10,
    fontSize: 14,
    color: "red",
    textAlign: "center",
  },
});

export default AuthScreen;
