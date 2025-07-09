import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  TouchableWithoutFeedback,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ethers } from "ethers";
import { Input } from "postcss";

export default function CreateScreen() {
  const { createSmartInsurance, getMyTokenContract, walletAddress } = useAuth();
  const router = useRouter();

  const [insuredWalletAddress, setInsuredWalletAddress] = useState<string>("");
  const [premiumAmount, setPremiumAmount] = useState<string>("");
  const [payoutAmount, setPayoutAmount] = useState<string>("");
  const [sensorType, setSensorType] = useState<string>(
    "s4agri:AmbientHumidity",
  );
  const [targetValue, setTargetValue] = useState("");
  const [latitude, setLatitude] = useState<string>("");
  const [longitude, setLongitude] = useState<string>("");
  const [radius, setRadius] = useState<string>("");
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

    if (!sensorType) {
      setErrorMessage("Please select a sensor type.");
      setIsLoading(false);
      return;
    }
    const latNum = parseFloat(latitude.replace(",", "."));
    const lonNum = parseFloat(longitude.replace(",", "."));
    const radNum = parseFloat(radius.replace(",", "."));
    const targetValueNum = parseFloat(targetValue.replace(",", "."));

    if (isNaN(latNum) || latNum < -90 || latNum > 90) {
      setErrorMessage("Latitude must be a valid number between -90 and 90.");
      setIsLoading(false);
      return;
    }
    if (isNaN(lonNum) || lonNum < -180 || lonNum > 180) {
      setErrorMessage("Longitude must be a valid number between -180 and 180.");
      setIsLoading(false);
      return;
    }
    if (isNaN(radNum) || radNum <= 0) {
      setErrorMessage("Radius must be a positive number.");
      setIsLoading(false);
      return;
    }

    if (!ethers.isAddress(tokenAddress)) {
      setErrorMessage("Token address not valid.");
      setIsLoading(false);
      return;
    }

    const queryJson = {
      topic: sensorType,
      geo: {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [latNum, lonNum],
        },
        properties: {
          radius: radNum,
        },
      },
    };
    const query = JSON.stringify(queryJson);

    try {
      const companyWalletAddress = walletAddress || "";
      if (!companyWalletAddress) {
        setErrorMessage(
          "Company wallet address not available. Please connect your wallet.",
        );
        setIsLoading(false);
        return;
      }

      const geoloc = `lat: ${latNum}, lon: ${lonNum}, radius: ${radNum} m`;

      const targetValueBigInt = ethers.toBigInt(targetValueNum);

      const deployedInsuranceAddress = await createSmartInsurance(
        insuredWalletAddress,
        query,
        sensorType,
        targetValueBigInt,
        geoloc,
        formattedPremiumAmount,
        formattedPayoutAmount,
        tokenAddress,
      );

      if (deployedInsuranceAddress) {
        setSuccessMessage(
          `Polizza SmartInsurance creata con successo! Indirizzo: ${deployedInsuranceAddress}`,
        );
        setInsuredWalletAddress("");
        setPremiumAmount("");
        setPayoutAmount("");
        setSensorType("s4agri:AmbientHumidity");
        setTargetValue(0);
        setLatitude("");
        setLongitude("");
        setRadius("");
      } else {
        setErrorMessage("Failed to deploy Smart Insurance.");
      }
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
        className="flex-1 bg-white"
      >
        <SafeAreaView className="flex-1 items-center justify-start pt-8">
          <Text className="text-3xl font-bold mb-6 text-purple-700">
            Create New Insurance
          </Text>
          <ScrollView className="w-full px-8">
            <View className="mb-4">
              <Text className="text-lg font-bold mb-2 text-purple-700">
                INSURED WALLET ADDRESS
              </Text>
              <TextInput
                className="w-full p-3 border-2 border-purple-700 rounded-lg text-base text-gray-800 bg-gray-50"
                placeholder="0x..."
                placeholderTextColor="#A0AEC0"
                value={insuredWalletAddress}
                onChangeText={setInsuredWalletAddress}
                keyboardType="default"
                autoCapitalize="none"
              />
            </View>

            <View className="mb-4">
              <Text className="text-lg font-bold mb-2 text-purple-700">
                PREMIUM AMOUNT (IN TOKEN UNITS)
              </Text>
              <TextInput
                className="w-full p-3 border-2 border-purple-700 rounded-lg text-base text-gray-800 bg-gray-50"
                placeholder="E.g. 10.5"
                placeholderTextColor="#A0AEC0"
                value={premiumAmount}
                onChangeText={setPremiumAmount}
                keyboardType="numeric"
              />
            </View>

            <View className="mb-4">
              <Text className="text-lg font-bold mb-2 text-purple-700">
                PAYOUT AMOUNT (IN TOKEN UNITS)
              </Text>
              <TextInput
                className="w-full p-3 border-2 border-purple-700 rounded-lg text-base text-gray-800 bg-gray-50"
                placeholder="E.g. 100"
                placeholderTextColor="#A0AEC0"
                value={payoutAmount}
                onChangeText={setPayoutAmount}
                keyboardType="numeric"
              />
            </View>

            <View className="mb-4">
              <Text className="text-xl font-bold mb-4 text-purple-700 text-center mt-4">
                Geographic Query Details
              </Text>
              <View className="mb-4">
                <Text className="text-lg font-bold mb-2 text-purple-700">
                  SENSOR TYPE
                </Text>
                <View className="w-full border-2 border-purple-700 rounded-lg overflow-hidden bg-gray-50">
                  <Picker
                    selectedValue={sensorType}
                    onValueChange={(itemValue: string) =>
                      setSensorType(itemValue)
                    }
                    className="text-base text-gray-800"
                  >
                    <Picker.Item
                      label="Ambient Humidity (s4agri)"
                      value="s4agri:AmbientHumidity"
                    />
                    <Picker.Item
                      label="Temperature (saref)"
                      value="saref:Temperature"
                    />
                  </Picker>
                </View>
              </View>

              <View className="mb-4">
                <Text className="text-lg font-bold mb-2 text-purple-700">
                  TARGET VALUE ({">"}=)
                </Text>
                <TextInput
                  className="w-full p-3 border-2 border-purple-700 rounded-lg text-base text-gray-800 bg-gray-50"
                  placeholder="25"
                  placeholderTextColor="#A0AEC0"
                  value={targetValue}
                  onChangeText={setTargetValue}
                  keyboardType="numeric"
                />
              </View>

              <View className="mb-4">
                <Text className="text-lg font-bold mb-2 text-purple-700">
                  LATITUDE
                </Text>
                <TextInput
                  className="w-full p-3 border-2 border-purple-700 rounded-lg text-base text-gray-800 bg-gray-50"
                  placeholder="e.g., 44.4948"
                  placeholderTextColor="#A0AEC0"
                  value={latitude}
                  onChangeText={setLatitude}
                  keyboardType="numeric"
                />
              </View>

              <View className="mb-4">
                <Text className="text-lg font-bold mb-2 text-purple-700">
                  LONGITUDE
                </Text>
                <TextInput
                  className="w-full p-3 border-2 border-purple-700 rounded-lg text-base text-gray-800 bg-gray-50"
                  placeholder="e.g., 11.3426"
                  placeholderTextColor="#A0AEC0"
                  value={longitude}
                  onChangeText={setLongitude}
                  keyboardType="numeric"
                />
              </View>

              <View className="mb-4">
                <Text className="text-lg font-bold mb-2 text-purple-700">
                  RADIUS (meters)
                </Text>
                <TextInput
                  className="w-full p-3 border-2 border-purple-700 rounded-lg text-base text-gray-800 bg-gray-50"
                  placeholder="e.g., 500"
                  placeholderTextColor="#A0AEC0"
                  value={radius}
                  onChangeText={setRadius}
                  keyboardType="numeric"
                />
              </View>
            </View>
            {/* Fine Campi per la Query Geografica */}

            <View className="mb-4">
              <Text className="text-lg font-bold mb-2 text-purple-700">
                TOKEN ADDRESS (ERC-20)
              </Text>
              <TextInput
                className="w-full p-3 border-2 border-purple-700 rounded-lg text-base bg-gray-100 text-gray-500"
                placeholder="0x..."
                placeholderTextColor="#A0AEC0"
                value={tokenAddress}
                editable={false}
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
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}
