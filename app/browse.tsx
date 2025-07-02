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
  Modal,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";

interface SmartInsuranceDetails {
  userWallet: string;
  companyWallet: string;
  premiumAmount: string;
  insuranceDescription: string;
  payoutAmount: string;
  tokenAddress: string;
  currentStatus: number;
}

const StatusMap: { [key: number]: string } = {
  0: "Pending",
  1: "Active",
  2: "Claimed",
  3: "Cancelled",
};

export default function BrowseScreen() {
  const {
    selectedAppRole,
    walletAddress,
    getSmartInsurancesForWallet,
    getDetailForSmartInsurance,
  } = useAuth();
  const router = useRouter();

  const [insuranceAddresses, setInsuranceAddresses] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [detailedInsuranceAddress, setDetailedInsuranceAddress] = useState("");
  const [details, setDetails] = useState<SmartInsuranceDetails | null>(null);
  const [isModalLoading, setIsModalLoading] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    const fetchInsurances = async () => {
      if (!walletAddress) {
        console.error("Wallet address is missing.");
        setInsuranceAddresses([]);
        setIsLoading(false);
        return;
      }
      try {
        const addresses = await getSmartInsurancesForWallet(walletAddress);
        setInsuranceAddresses(addresses);
        console.log(`Smart insurances ottenute: ${addresses.length}`);
      } catch (e) {
        console.error("Error fetching smart insurances:", e);
        setInsuranceAddresses([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInsurances();
  }, [walletAddress, getSmartInsurancesForWallet]);
  useEffect(() => {
    const fetchDetailInsurance = async () => {
      if (!detailedInsuranceAddress) {
        setDetails(null);
        return;
      }

      setIsModalLoading(true);
      try {
        const insuranceDetails = await getDetailForSmartInsurance(
          detailedInsuranceAddress,
        );
        setDetails(insuranceDetails);
      } catch (e) {
        console.error("Error fetching detailed insurance:", e);
        setDetails(null);
        Alert.alert("Errore", "Impossibile caricare i dettagli della polizza.");
      } finally {
        setIsModalLoading(false);
      }
    };

    fetchDetailInsurance();
  }, [detailedInsuranceAddress, getDetailForSmartInsurance]);

  const copyToClipboard = async (text: string) => {
    await Clipboard.setStringAsync(text);
    Alert.alert("Copied!", "Address copied to Clipboard!.");
  };

  const CardView = ({ address }: { address: string }) => {
    return (
      <TouchableOpacity
        onPress={() => {
          setDetailedInsuranceAddress(address);
        }}
      >
        <View
          className={`w-[350px] h-[60px] my-5 rounded-lg flex-row items-center justify-between px-4 border-2 ${
            selectedAppRole === "user" ? "border-green-500" : "border-blue-500"
          }`}
        >
          <Text className={`font-bold`}>
            {`${address.slice(0, 10)}...${address.slice(-4)}`}
          </Text>
          <Text
            className={`text-sm ${
              selectedAppRole === "user" ? "text-green-700" : "text-blue-700"
            }`}
          >
            Show Details
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView className="bg-white h-full items-center justify-center">
      <Text
        className={`text-2xl font-bold my-5 ${
          selectedAppRole === "user" ? "text-green-500" : "text-blue-500"
        }`}
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
        contentContainerStyle={{ alignItems: "center", paddingVertical: 20 }}
      >
        {isLoading ? (
          <ActivityIndicator
            size="large"
            className="mt-[30px]"
            color="#6b46c1"
          />
        ) : insuranceAddresses.length > 0 ? (
          insuranceAddresses.map((insurance) => (
            <CardView key={insurance} address={insurance} />
          ))
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

      <Modal
        animationType="slide"
        transparent={true}
        visible={!!detailedInsuranceAddress}
        onRequestClose={() => {
          setDetailedInsuranceAddress("");
          setDetails(null);
        }}
      >
        <View className="flex-1 justify-center items-center bg-black/60">
          <View className="m-5 bg-white rounded-2xl p-9 items-center shadow-xl w-[90%] max-h-[80%]">
            <Text className="text-2xl font-bold mb-5 text-gray-700">
              Smart Insurance Details
            </Text>
            {isModalLoading ? (
              <ActivityIndicator
                size="large"
                color="#6b46c1"
                className="mt-5"
              />
            ) : details ? (
              <ScrollView className="w-full mb-5">
                <View className="flex-row justify-between items-center mb-2.5 py-1.5 border-b border-gray-200">
                  <Text className="text-base font-semibold text-purple-700 flex-1">
                    Address:
                  </Text>
                  <TouchableOpacity
                    onPress={() => copyToClipboard(detailedInsuranceAddress)}
                  >
                    <Text className="text-base text-blue-500 underline flex-2 text-right">
                      {`${detailedInsuranceAddress.slice(0, 8)}...${detailedInsuranceAddress.slice(-6)}`}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View className="flex-row justify-between items-center mb-2.5 py-1.5 border-b border-gray-200">
                  <Text className="text-base font-semibold text-purple-700 flex-1">
                    User Wallet:
                  </Text>
                  <TouchableOpacity
                    onPress={() => copyToClipboard(details.userWallet)}
                  >
                    <Text className="text-base text-blue-500 underline flex-2 text-right">
                      {`${details.userWallet.slice(0, 8)}...${details.userWallet.slice(-6)}`}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View className="flex-row justify-between items-center mb-2.5 py-1.5 border-b border-gray-200">
                  <Text className="text-base font-semibold text-purple-700 flex-1">
                    Company Wallet:
                  </Text>
                  <TouchableOpacity
                    onPress={() => copyToClipboard(details.companyWallet)}
                  >
                    <Text className="text-base text-blue-500 underline flex-2 text-right">
                      {`${details.companyWallet.slice(0, 8)}...${details.companyWallet.slice(-6)}`}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View className="flex-row justify-between items-center mb-2.5 py-1.5 border-b border-gray-200">
                  <Text className="text-base font-semibold text-purple-700 flex-1">
                    Premium Amount:
                  </Text>
                  <Text className="text-base text-gray-700 flex-2 text-right">
                    {details.premiumAmount} (Token Units)
                  </Text>
                </View>
                <View className="flex-row justify-between items-center mb-2.5 py-1.5 border-b border-gray-200">
                  <Text className="text-base font-semibold text-purple-700 flex-1">
                    Payout Amount:
                  </Text>
                  <Text className="text-base text-gray-700 flex-2 text-right">
                    {details.payoutAmount} (Token Units)
                  </Text>
                </View>
                <View className="flex-row justify-between items-center mb-2.5 py-1.5 border-b border-gray-200">
                  <Text className="text-base font-semibold text-purple-700 flex-1">
                    Description:
                  </Text>
                  <Text className="text-base text-gray-700 flex-2 text-right">
                    {details.insuranceDescription}
                  </Text>
                </View>
                <View className="flex-row justify-between items-center mb-2.5 py-1.5 border-b border-gray-200">
                  <Text className="text-base font-semibold text-purple-700 flex-1">
                    Token Address:
                  </Text>
                  <TouchableOpacity
                    onPress={() => copyToClipboard(details.tokenAddress)}
                  >
                    <Text className="text-base text-blue-500 underline flex-2 text-right">
                      {`${details.tokenAddress.slice(0, 8)}...${details.tokenAddress.slice(-6)}`}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View className="flex-row justify-between items-center mb-2.5 py-1.5 border-b border-gray-200">
                  <Text className="text-base font-semibold text-purple-700 flex-1">
                    Status:
                  </Text>
                  <Text className="text-base text-gray-700 flex-2 text-right">
                    {StatusMap[details.currentStatus] || "Unknown"}
                  </Text>
                </View>
              </ScrollView>
            ) : (
              <Text className="text-base text-gray-600 mb-5">
                No details found.
              </Text>
            )}
            <Button
              title="Close"
              onPress={() => {
                setDetailedInsuranceAddress("");
                setDetails(null);
              }}
              color="#6b46c1"
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
