import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  TouchableWithoutFeedback,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ethers } from "ethers";

export default function CreateScreen() {
  const { createSmartInsurance, getMyTokenContract } = useAuth();
  const router = useRouter();

  const [insuredWalletAddress, setInsuredWalletAddress] = useState<string>("");
  const [insuranceDescription, setInsuranceDescription] = useState<string>("");
  const [premiumAmount, setPremiumAmount] = useState<string>("");
  const [payoutAmount, setPayoutAmount] = useState<string>("");
  const [tokenAddress, setTokenAddress] = useState<string>("");

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    const fetchTokenAddress = async () => {
      const tokenContract = getMyTokenContract();
      if (tokenContract) {
        setTokenAddress(await tokenContract.getAddress());
      }
    };

    fetchTokenAddress();
  }, [getMyTokenContract]);

  const handleSubmit = async () => {
    setErrorMessage("");
    setSuccessMessage("");
    setIsLoading(true);

    const formattedPremiumAmount = premiumAmount.replace(",", ".");
    const formattedPayoutAmount = payoutAmount.replace(",", ".");

    if (!ethers.isAddress(insuredWalletAddress)) {
      setErrorMessage("Insured Wallet address not valid.");
      setIsLoading(false);
      return;
    }
    if (insuranceDescription.trim() === "") {
      setErrorMessage("Incurance description empty.");
      setIsLoading(false);
      return;
    }
    // Usa i valori formattati per la validazione numerica
    if (
      isNaN(parseFloat(formattedPremiumAmount)) ||
      parseFloat(formattedPremiumAmount) <= 0
    ) {
      setErrorMessage("Premium amount must be greater than 0.");
      setIsLoading(false);
      return;
    }
    if (
      isNaN(parseFloat(formattedPayoutAmount)) ||
      parseFloat(formattedPayoutAmount) <= 0
    ) {
      setErrorMessage("Payout amount must be greater than 0.");
      setIsLoading(false);
      return;
    }
    if (!ethers.isAddress(tokenAddress)) {
      setErrorMessage("Token address not valid.");
      setIsLoading(false);
      return;
    }

    try {
      const deployedInsuranceAddress = await createSmartInsurance(
        insuredWalletAddress,
        insuranceDescription,
        formattedPremiumAmount,
        formattedPayoutAmount,
        tokenAddress,
      );

      setSuccessMessage(
        `Polizza SmartInsurance creata con successo! Indirizzo: ${deployedInsuranceAddress}`,
      );
      setInsuredWalletAddress("");
      setInsuranceDescription("");
      setPremiumAmount("");
      setPayoutAmount("");
      // setTokenAddress("");
    } catch (error: any) {
      console.error("Errore nella creazione della SmartInsurance:", error);
      setErrorMessage(`Error: ${error.message || "Something went wrong."}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <SafeAreaView className="bg-white h-full items-center justify-start pt-8">
          <Text className="text-3xl font-bold mb-6 text-purple-700">
            Create New Insurance
          </Text>
          <View className="w-full mx-8">
            <View className="mx-8 mb-4">
              <Text className="text-lg font-medium text-purple-700 font-bold">
                INSURED WALLET ADDRESS
              </Text>
              <TextInput
                className="w-full p-3 border-2 border-purple-700 rounded-lg text-lg text-gray-500 bg-gray-50"
                placeholder="0x..."
                value={insuredWalletAddress}
                onChangeText={setInsuredWalletAddress}
                keyboardType="default"
                autoCapitalize="none"
              />
            </View>

            <View className="mx-8 mb-4">
              <Text className="text-lg font-medium text-purple-700 font-bold">
                INSURANCE DESCRIPTION
              </Text>
              <TextInput
                className="w-full p-3 border-2 border-purple-700 rounded-lg text-lg text-gray-500 bg-gray-50"
                placeholder="E.g. Flood damage insurance"
                value={insuranceDescription}
                onChangeText={setInsuranceDescription}
                multiline
                numberOfLines={3}
              />
            </View>

            <View className="mx-8 mb-4">
              <Text className="text-lg font-medium text-purple-700 font-bold">
                PREMIUM AMOUNT (IN TOKEN UNITS)
              </Text>
              <TextInput
                className="w-full p-3 border-2 border-purple-700 rounded-lg text-lg text-gray-500 bg-gray-50"
                placeholder="E.g. 10,5"
                value={premiumAmount}
                onChangeText={setPremiumAmount}
                keyboardType="numeric"
              />
            </View>

            <View className="mx-8 mb-4">
              <Text className="text-lg font-medium text-purple-700 font-bold">
                PAYOUT AMOUNT (IN TOKEN UNITS)
              </Text>
              <TextInput
                className="w-full p-3 border-2 border-purple-700 rounded-lg text-lg text-gray-500 bg-gray-50"
                placeholder="E.g. 100"
                value={payoutAmount}
                onChangeText={setPayoutAmount}
                keyboardType="numeric"
              />
            </View>

            <View className="mx-8 mb-4">
              <Text className="text-lg font-medium text-purple-700 font-bold">
                TOKEN ADDRESS (ERC-20)
              </Text>
              <TextInput
                className="w-full p-3 border-2 border-purple-700 rounded-lg text-lg text-gray-500 bg-gray-50"
                placeholder="0x..."
                value={tokenAddress}
                onChangeText={setTokenAddress}
                keyboardType="default"
                autoCapitalize="none"
              />
            </View>

            {isLoading && (
              <View className="flex-row items-center justify-center mb-4">
                <ActivityIndicator
                  size="small"
                  color="#6b46c1"
                  className="mr-2"
                />
                <Text className="text-lg text-purple-600 font-light">
                  Interacting with blockchain ...
                </Text>
              </View>
            )}
            {errorMessage && (
              <View className="flex flex-row items-center justify-center mb-4">
                <Image
                  source={require("../assets/images/error-red.png")}
                  className="w-5 h-5"
                  resizeMode="contain"
                />
                <Text
                  className="text-red-500 text-center text-base mx-2"
                  onPress={() => {
                    Alert.alert("Error", errorMessage);
                  }}
                >
                  Error processing Smart Insurance
                </Text>
              </View>
            )}
            {successMessage && (
              <View className="flex flex-row items-center justify-center mb-4">
                <Image
                  source={require("../assets/images/success-green.png")}
                  className="w-5 h-5"
                  resizeMode="contain"
                />
                <Text className="text-green-600 text-center text-base mx-2">
                  Smart Insurance created successfully!
                </Text>
              </View>
            )}
            <View className="justify-center items-center my-4">
              <TouchableOpacity
                onPress={handleSubmit}
                className={`bg-purple-700 rounded-full w-[250px] h-[50px] items-center justify-center mb-5 ${isLoading ? "opacity-50" : ""}`}
                disabled={isLoading}
              >
                <Text className="text-white font-bold text-xl">
                  {isLoading ? "Submitting..." : "Create Smart Insurance"}
                </Text>
              </TouchableOpacity>
            </View>

            <View className="justify-center items-center mb-4">
              <TouchableOpacity
                onPress={() => {
                  router.replace("/dashboard");
                }}
                className="mt-4"
              >
                <Text className="text-lg font-medium text-blue-500 underline">
                  Go to Dashboard
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}
