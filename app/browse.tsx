import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Button,
  Image,
  Alert,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";

export default function BrowseScreen() {
  const { selectedAppRole, walletAddress, getSmartInsurancesForWallet } =
    useAuth();
  const router = useRouter();

  const [insuranceAddresses, setInsuranceAddresses] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  useEffect(() => {
    setIsLoading(true);
    const fetchInsurances = async () => {
      if (!walletAddress) {
        console.error("Wallet address is missing in wallet");
        setInsuranceAddresses([]);
        setIsLoading(false);
        return;
      }
      try {
        const addresses = await getSmartInsurancesForWallet(walletAddress);
        // @ts-ignore
        setInsuranceAddresses(addresses);
        //        setInsuranceAddresses(["0xvud9fsyugxwhjkshajkfyufdyuoacx3623277c7yg"]);
        setIsLoading(false);
        console.log(`smart insurances ottenute: ${insuranceAddresses}`);
      } catch (e) {
        console.error(e);
        setInsuranceAddresses([]);
        setIsLoading(false);
      }
    };

    fetchInsurances();
  }, [walletAddress]);

  const CardView = ({ address }: { address: string }) => {
    return (
      <View
        className={`w-[350px] h-[60px] my-5 rounded-lg flex-row items-center justify-between px-4 border-2 ${
          selectedAppRole === "user" ? "border-green-500" : "border-blue-500"
        }`}
      >
        <Text
          className={`font-bold`}
          onPress={() => {
            Alert.alert("Insurance Address", `${address}`, [
              {
                text: "Copy",
                onPress: () => {
                  Clipboard.setStringAsync(address);
                },
              },
              { text: "Close", style: "cancel" },
            ]);
          }}
        >
          {address.substring(0, 6)}...{address.substring(address.length - 4)}
        </Text>
        <View className="flex flex-row items-center gap-4">
          <TouchableOpacity className="flex-row items-center">
            <Image
              source={require("../assets/images/check.png")}
              resizeMode="contain"
              className="h-9 w-9 my-1"
            />
          </TouchableOpacity>
          <TouchableOpacity className="flex-row items-center">
            <Image
              source={require("../assets/images/details.png")}
              resizeMode="contain"
              className="h-9 w-9 my-1"
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView className="bg-white h-full items-center justify-center">
      <Text
        className={`text-2xl font-bold my-5 ${selectedAppRole === "user" ? "text-green-500" : "text-blue-500"}`}
      >
        Your Insurances
      </Text>

      <Text
        onPress={() => {
          router.replace("/dashboard");
        }}
        className={"text-lg font-medium text-blue-300"}
      >
        Home
      </Text>
      <ScrollView
        className="h-full w-full"
        contentContainerStyle={{ alignItems: "center" }}
      >
        {insuranceAddresses.length > 0 ? (
          insuranceAddresses.map((insurance) => (
            <CardView key={insurance} address={insurance} />
          ))
        ) : isLoading ? (
          <ActivityIndicator size="large" className="mt-[30px]" />
        ) : (
          <View className="items-center justify-center mt-[30px]">
            <Text className={`font-light text-3xl mt-[80px] text-gray-500`}>
              No insurance found
            </Text>
            <Image
              source={require("../assets/images/not-found.png")}
              resizeMode={"contain"}
              className="h-12 w-12 my-1"
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
