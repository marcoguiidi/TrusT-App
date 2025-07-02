// app/settings.tsx
import React from "react";
import { View, Text, StyleSheet, Button } from "react-native";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "expo-router";

export default function SettingsScreen() {
  const { selectedAppRole, walletAddress, disconnectWallet } = useAuth();
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Impostazioni</Text>
      {selectedAppRole && (
        <Text style={styles.infoText}>
          Stai gestendo le impostazioni come **{selectedAppRole.toUpperCase()}
          **.
        </Text>
      )}
      {walletAddress && (
        <Text style={styles.infoText}>
          Wallet: {walletAddress.substring(0, 6)}...
          {walletAddress.substring(walletAddress.length - 4)}
        </Text>
      )}
      <Button
        title="Torna alla Dashboard"
        onPress={() => router.replace("/dashboard")}
        color="#28a745"
      />
      <View style={{ height: 10 }} />
      <Button
        title="Disconnetti Wallet"
        onPress={disconnectWallet}
        color="#ff6347"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#f0f4f7",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    color: "#17a2b8",
  },
  infoText: {
    fontSize: 16,
    marginBottom: 15,
    textAlign: "center",
    color: "#333",
  },
});
