import React from "react";
import {
  View,
  Text,
  Image,
  Alert,
  TouchableOpacity,
  ImageSourcePropType,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { Href, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";

export default function DashboardScreen() {
  const { selectedAppRole, walletAddress, disconnectWallet } = useAuth();
  const router = useRouter();

  const isCompany = selectedAppRole === "company";
  const primaryColorClass = isCompany ? "text-blue-500" : "text-green-500";
  const bgColorClass = isCompany ? "bg-blue-500" : "bg-green-500";
  const iconSource = isCompany
    ? require("../assets/images/company-home.jpeg")
    : require("../assets/images/person-icon.png");

  const handleDisconnect = async () => {
    await disconnectWallet();
    router.replace("/");
  };

  const handleShowAddress = () => {
    if (walletAddress) {
      Alert.alert("Wallet Address", `${walletAddress}`, [
        {
          text: "Copy",
          onPress: () => {
            Clipboard.setStringAsync(walletAddress);
          },
        },
        { text: "Close", style: "cancel" },
      ]);
    }
  };

  interface Button {
    label: string;
    icon: ImageSourcePropType;
    path: Href<any>;
  }

  const buttons: Button[] = [
    {
      label: "Browse Contracts",
      icon: require("../assets/images/browse-icon.png"),
      path: "/browse",
    },
    ...(isCompany
      ? [
          {
            label: "New Insurance",
            icon: require("../assets/images/contract-icon.png"),
            path: "/create",
          },
          {
            label: "Expirations",
            icon: require("../assets/images/expirations-icon.png"),
            path: "/expirations",
          },
        ]
      : []),
  ];

  if (!selectedAppRole) {
    return (
      <SafeAreaView className="bg-white h-full items-center justify-center">
        <Text>Wallet not configured</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white pt-8">
      <View className="flex-1 items-center px-6">
        <Image
          source={iconSource}
          className="h-24 w-24 rounded-full mb-6 shadow-md"
        />
        <Text className={`text-4xl font-extrabold mb-2 ${primaryColorClass}`}>
          Welcome!
        </Text>
        {walletAddress && (
          <TouchableOpacity onPress={handleShowAddress} className="mb-8">
            <Text className="text-base text-gray-500">
              Wallet: {walletAddress.substring(0, 6)}...
              {walletAddress.substring(walletAddress.length - 4)}
            </Text>
          </TouchableOpacity>
        )}

        <View className="w-full items-center gap-6 mt-12">
          {buttons.map((button, index) => (
            <TouchableOpacity
              key={index}
              className={`flex-row items-center justify-center rounded-2xl w-full h-[80px] shadow-lg ${bgColorClass}`}
              onPress={() => router.push(button.path)}
            >
              <Image
                source={button.icon}
                className="w-10 h-10 mr-4"
                resizeMode="contain"
              />
              <Text className="text-2xl text-white font-bold">
                {button.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          onPress={handleDisconnect}
          className="flex-row items-center justify-center mt-auto mb-10"
        >
          <Image
            source={require("../assets/images/logout-icon.png")}
            className="w-6 h-6 mr-2"
            resizeMode="contain"
          />
          <Text className="text-lg font-bold text-gray-400 underline">
            Disconnect Wallet
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
