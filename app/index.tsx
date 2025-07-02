import "@walletconnect/react-native-compat";
import React, { useEffect, useState } from "react"; // Importa useEffect
import {
  View,
  Text,
  StyleSheet,
  Button,
  ActivityIndicator,
  Modal,
  TouchableOpacity,
  Image,
  Alert,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "expo-router";
import "../global.css";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";

export default function UniversalLaunchScreen() {
  const {
    selectedAppRole,
    selectAppRole,
    walletConnected,
    connectWallet,
    walletAddress,
    disconnectWallet,
    walletTypeOnChain,
    isCoreContractsReady,
    registerWalletOnChain,
  } = useAuth();

  const router = useRouter();
  const [showEntryModal, setShowEntryModal] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  // Nuovo useEffect per gestire il reindirizzamento automatico
  useEffect(() => {
    // Assicurati che il wallet sia connesso, i contratti siano pronti,
    // e che walletTypeOnChain abbia un valore (non null)
    if (walletConnected && isCoreContractsReady && walletTypeOnChain) {
      console.log(
        `DEBUG: Wallet connesso e ruolo on-chain (${walletTypeOnChain}) già rilevato. Reindirizzo alla dashboard.`,
      );
      router.replace("/dashboard");
    }
  }, [walletConnected, isCoreContractsReady, walletTypeOnChain, router]);

  const handleRoleSelectionAndRegistration = async (
    role: "user" | "company",
  ) => {
    await selectAppRole(role);

    if (walletConnected && walletAddress && isCoreContractsReady) {
      if (!walletTypeOnChain || walletTypeOnChain !== role) {
        try {
          console.log(
            `LOG: Chiamata da index a registerWalletOnChian per wallet ${walletAddress} con ruolo ${role}`,
          );
          await registerWalletOnChain(role); // Invia la transazione per registrare il ruolo on-chain
          console.log(`Wallet registered on-chain as ${role}.`);
          router.replace("/dashboard");
        } catch (error) {
          console.error("Errore durante la registrazione on-chain:", error);
        }
      } else {
        console.log(
          `Wallet already registered as ${walletTypeOnChain}. Navigating to dashboard.`,
        );
        router.replace("/dashboard");
      }
    } else {
      console.warn(
        "Wallet non connesso o contratti non pronti. Impossibile registrare on-chain.",
      );
    }
  };

  // Se gli stati non sono ancora caricati, mostra un indicatore di caricamento
  if (
    walletConnected === undefined ||
    selectedAppRole === undefined ||
    isCoreContractsReady === undefined
  ) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text style={styles.loadingText}>Caricamento stato app...</Text>
      </View>
    );
  }

  // --- LOGICA DI VISUALIZZAZIONE DEL COMPONENTE ---
  // Aggiungi un controllo per il reindirizzamento qui, prima di mostrare qualsiasi UI.
  // Questo blocco dovrebbe essere prima degli altri `if` per assicurarsi che il reindirizzamento avvenga il prima possibile.
  // Tuttavia, l'useEffect sopra è l'approccio preferito per i reindirizzamenti basati su stato.
  // Questo `if` può fungere da piccola ottimizzazione o fallback visivo.
  if (walletConnected && isCoreContractsReady && walletTypeOnChain) {
    // Se siamo qui, significa che l'useEffect non ha ancora reindirizzato,
    // o che l'utente è tornato su questa pagina dopo essere stato reindirizzato.
    // Mostra un indicatore di caricamento breve prima del reindirizzamento.
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#00ff00" />
        <Text style={styles.loadingText}>Accesso automatico...</Text>
      </View>
    );
  }

  if (!walletConnected) {
    // Caso 1: Wallet non connesso

    return (
      <SafeAreaView className="w-full h-full items-center justify-start top-4 flex">
        <Modal visible={showEntryModal} animationType="slide">
          <View className="flex-1 items-center justify-center bg-black/40">
            <View className="w-[300px] h-[500px] bg-white p-4 rounded-3xl items-center">
              <Text className="text-2xl font-bold text-purple-700 mb-4">
                Quick Start Guide
              </Text>
              <Text className="text-lg text-gray-500 my-5">
                1. Tap the "Connect Wallet" Button and sync with your favourite
                wallet.
              </Text>
              <Text className="text-lg text-gray-500 my-5">
                2. Select your role (User/Company) and confirm the first
                transaction to register the wallet on chain.
              </Text>
              <Text className="text-lg text-gray-500 my-5">
                3. Confirm the second transaction to set the selected role for
                your wallet on chain.
              </Text>
              <TouchableOpacity
                className="items-center justify-center rounded-full bg-purple-700 w-[200px] h-[40px] absolute bottom-4"
                onPress={() => setShowEntryModal(false)}
              >
                <Text className="text-xl text-white font-bold">
                  Get started
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
        <Image
          source={require("../assets/images/home-icon.png")}
          className="w-[60px] h-[60px] top-3"
          resizeMode="contain"
        />
        <Text className="mt-[70px] text-4xl font-bold text-purple-700">
          Welcome!
        </Text>

        <Text className="mt-[40px] text-lg text-gray-500">
          Connect your wallet to Log In
        </Text>
        <TouchableOpacity
          onPress={connectWallet}
          className="bg-purple-700 rounded-full w-[230px] h-[50px] items-center justify-center mt-[30px]"
        >
          <Text className="text-white font-bold text-xl">Connect Wallet</Text>
        </TouchableOpacity>

        {errorMessage && (
          <Text className="text-red-500 my-5 absolute bottom-[50px]">
            {errorMessage}
          </Text>
        )}
        <TouchableOpacity
          className="items-center justify-center rounded-full w-[40px] h-[40px] absolute bottom-9"
          onPress={() => setShowEntryModal(true)}
        >
          <Image
            source={require("../assets/images/question-mark-icon.png")}
            className="w-[40px] h-[40px]"
            resizeMode="contain"
          />
        </TouchableOpacity>
      </SafeAreaView>
    );
  } else if (!isCoreContractsReady) {
    // Caso 2: Wallet connesso ma contratti non pronti (ancora in caricamento o errore)
    return (
      <View style={styles.container}>
        <Text className="text-3xl text-purple-700 font-bold mb-10">
          Wallet Connected!
        </Text>
        <ActivityIndicator size="large" color="#00ff00" />
      </View>
    );
  } else if (!selectedAppRole || !walletTypeOnChain) {
    // Caso 3: Wallet connesso e contratti pronti, ma ruolo non selezionato/registrato on-chain
    // Questo è il punto in cui l'utente selezionerà il ruolo se non ne ha uno on-chain.
    return (
      <SafeAreaView className="w-full h-full items-center justify-start top-4 flex">
        <Text className="text-2xl text-purple-700 font-bold">
          Wallet Connected:
        </Text>
        {walletAddress && (
          <Text
            className="text-lg text-neutral-400 mt-4"
            onPress={() => {
              Alert.alert("Wallet Address", `${walletAddress}`, [
                {
                  text: "Copy",
                  onPress: () => {
                    Clipboard.setStringAsync(walletAddress);
                  },
                },
                { text: "Close", style: "cancel" },
              ]);
            }}
          >
            Wallet: {walletAddress.substring(0, 6)}...
            {walletAddress.substring(walletAddress.length - 4)}
          </Text>
        )}
        <Text className="text-2xl text-purple-700 mt-[40px] self-start mx-5">
          Select your Role
        </Text>
        <View className="w-full h-[400px] mt-[10px] flex-row gap-5 items-center justify-center">
          <TouchableOpacity
            className="bg-green-500 rounded-lg w-[150px] h-[200px] items-center justify-center"
            onPress={() => handleRoleSelectionAndRegistration("user")}
          >
            <Image
              source={require("../assets/images/person-icon-white.png")}
              resizeMode="contain"
              className="w-[60px] h-[60px]"
            />
            <Text className="text-3xl font-bold text-white mt-5">User</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="bg-blue-500 rounded-lg w-[150px] h-[200px] items-center justify-center"
            onPress={() => handleRoleSelectionAndRegistration("company")}
          >
            <Image
              source={require("../assets/images/company-white-icon.png")}
              resizeMode="contain"
              className="w-[60px] h-[60px]"
            />
            <Text className="text-3xl font-bold text-white mt-5">Company</Text>
          </TouchableOpacity>
        </View>
        <Text className="text-gray-500 text-lg">
          The selection can't be changed in future
        </Text>
        <TouchableOpacity
          onPress={disconnectWallet}
          className="absolute bottom-10 right-7 flex-row justify-center items-center"
        >
          <Image
            source={require("../assets/images/logout-icon.png")}
            className="w-6 h-6 ml-5"
          />
          <Text className="text-lg font-bold text-neutral-400 underline">
            Disconnect Wallet
          </Text>
        </TouchableOpacity>
        {errorMessage && (
          <Text className="text-red-500 my-5 absolute bottom-[50px]">
            {errorMessage}
          </Text>
        )}
      </SafeAreaView>
    );
  } else {
    // Questo `else` sarà raggiunto solo se l'useEffect non ha reindirizzato
    // (ad esempio, se `router.replace` ha un ritardo)
    // o in scenari di fallback.
    // L'utente è autenticato e il ruolo on-chain è già stato impostato.
    return (
      <View style={styles.container}>
        <Button
          title="Go to dashboard"
          onPress={() => router.replace("/dashboard")}
        />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#f8f8f8",
  },
  loadingContainer: {
    backgroundColor: "#e0f7fa",
  },
  loadingText: {
    marginTop: 15,
    fontSize: 18,
    color: "#007bff",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
    color: "#333",
  },
  promptText: {
    fontSize: 18,
    color: "#777",
    marginBottom: 20,
    textAlign: "center",
  },
  statusText: {
    fontSize: 16,
    marginBottom: 10,
    color: "#555",
  },
  rolePrompt: {
    fontSize: 18,
    fontWeight: "bold",
    marginVertical: 20,
    textAlign: "center",
    color: "#333",
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    paddingHorizontal: 20,
    marginBottom: 20,
  },
});
