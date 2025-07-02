import React from "react";
import { View, Text, Button, StyleSheet } from "react-native";
import { useAuth } from "../context/AuthContext";
import { router, Redirect } from "expo-router";

const UserHomeScreen = () => {
  const {
    disconnectWallet,
    walletAddress,
    clearAllData,
    walletConnected,
    role,
  } = useAuth();

  // Reindirizza se il wallet è disconnesso o il ruolo non è utente
  if (!walletConnected || role !== "user") {
    // Se disconnesso, vai alla schermata di autenticazione.
    // Se il ruolo è sbagliato, ricarica _layout che reindirizzerà correttamente.
    return <Redirect href="/auth" />;
  }

  const handleDisconnect = async () => {
    await disconnectWallet();
    router.replace("/auth"); // Torna alla schermata di autenticazione
  };

  const handleResetApp = async () => {
    await clearAllData();
    router.replace("/"); // Torna alla selezione ruolo (index.tsx)
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Benvenuto Utente!</Text>
      {walletAddress && (
        <Text style={styles.walletText}>
          Wallet Connesso: {walletAddress.substring(0, 6)}...
          {walletAddress.substring(walletAddress.length - 4)}
        </Text>
      )}
      <View style={styles.buttonContainer}>
        <Button
          title="Disconnetti Wallet"
          onPress={handleDisconnect}
          color="red"
        />
      </View>
      <View style={styles.buttonContainer}>
        <Button
          title="Resetta App (torna alla scelta ruolo)"
          onPress={handleResetApp}
          color="grey"
        />
      </View>
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
    marginBottom: 20,
    fontWeight: "bold",
  },
  walletText: {
    fontSize: 16,
    marginBottom: 30,
    textAlign: "center",
  },
  buttonContainer: {
    width: "80%",
    marginVertical: 10,
  },
});

export default UserHomeScreen;
