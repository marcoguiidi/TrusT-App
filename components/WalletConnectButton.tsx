import React from "react";
import { Button, Text, View, StyleSheet } from "react-native";
import { useAuth } from "../context/AuthContext";

const WalletConnectButton = () => {
  const { walletConnected, connectWallet, disconnectWallet, walletAddress } =
    useAuth();

  return (
    <View style={styles.container}>
      {walletConnected ? (
        <View style={styles.connectedContainer}>
          <Text style={styles.addressText}>
            Connesso come:{" "}
            {walletAddress
              ? `${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)}`
              : "N/A"}
          </Text>
          <Button
            title="Disconnetti Wallet"
            onPress={disconnectWallet}
            color="#ff6347"
          />
        </View>
      ) : (
        <Button
          title="Connetti Wallet"
          onPress={connectWallet}
          color="#4CAF50"
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  connectedContainer: {
    alignItems: "center",
  },
  addressText: {
    marginBottom: 10,
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
    color: "#333",
  },
});

export default WalletConnectButton;
