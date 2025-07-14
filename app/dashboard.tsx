import React from "react";
import { View, Text, Image, Alert, TouchableOpacity } from "react-native";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";

export default function DashboardScreen() {
  const { selectedAppRole, walletAddress, disconnectWallet } = useAuth();
  const router = useRouter();

  if (selectedAppRole === "company") {
    return (
      <SafeAreaView className="bg-white h-full items-center">
        <Image
          source={require("../assets/images/company-home.jpeg")}
          className="h-20 w-20 mt-5 mb-5"
        />
        <Text className="text-3xl text-blue-500 font-bold">Welcome!</Text>
        {walletAddress && (
          <Text
            className="text-lg text-neutral-400 mb-4"
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
        <View className="rounded-lg mt-10 w-full items-center justify-center gap-7">
          <TouchableOpacity
            className="flex-row items-center rounded-full bg-blue-500 w-[280px] h-[80px]"
            onPress={() => {
              router.push("/browse");
            }}
          >
            <Image
              source={require("../assets/images/browse-icon.png")}
              className="w-10 h-10 ml-5 mr-3"
              resizeMode="contain"
            />
            <Text className="text-2xl text-white font-bold">
              Browse Contracts
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-row items-center rounded-full bg-blue-500 w-[280px] h-[80px]"
            onPress={() => {
              router.push("/create");
            }}
          >
            <Image
              source={require("../assets/images/contract-icon.png")}
              className="w-10 h-10 ml-5 mr-3"
              resizeMode="contain"
            />
            <Text className="text-2xl text-white font-bold">New Insurance</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={async () => {
            await disconnectWallet();
            router.replace("/");
          }}
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
      </SafeAreaView>
    );
  } else if (selectedAppRole === "user") {
    return (
      <SafeAreaView className="bg-white h-full items-center">
        <Image
          source={require("../assets/images/person-icon.png")}
          className="h-20 w-20 mt-5 mb-5"
        />
        <Text className="text-3xl text-green-500 font-bold">Welcome!</Text>
        {walletAddress && (
          <Text
            className="text-lg text-neutral-400 mb-4"
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
        <View className="rounded-lg mt-10 w-full items-center justify-center gap-7">
          <TouchableOpacity
            className="flex-row items-center rounded-full bg-green-500 w-[280px] h-[80px]"
            onPress={() => {
              router.push("/browse");
            }}
          >
            <Image
              source={require("../assets/images/browse-icon.png")}
              className="w-10 h-10 ml-5 mr-3"
              resizeMode="contain"
            />
            <Text className="text-2xl text-white font-bold">
              Browse Contracts
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={async () => {
            await disconnectWallet();
            router.replace("/");
          }}
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
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView className="bg-white h-full items-center">
      <Text>Wallet not configured</Text>
    </SafeAreaView>
  );
}
