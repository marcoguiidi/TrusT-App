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
  ScrollView,
  Modal,
  Platform,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ethers } from "ethers";
import DateTimePicker from "@react-native-community/datetimepicker";
import { format } from "date-fns";
import { Divider } from "react-native-paper";

import MapView, { Marker, Circle, PROVIDER_GOOGLE } from "react-native-maps";
import * as Location from "expo-location";

export default function CreateScreen() {
  const {
    createSmartInsurance,
    getMyTokenContract,
    walletAddress,
    deploySmartInsuranceState,
    clearDeployStatus,
  } = useAuth();
  const router = useRouter();

  const [insuredWalletAddress, setInsuredWalletAddress] = useState<string>("");
  const [premiumAmount, setPremiumAmount] = useState<string>("");
  const [payoutAmount, setPayoutAmount] = useState<string>("");
  const [sensorType, setSensorType] = useState<string>(
    "s4agri:AmbientHumidity",
  );
  const [targetValue, setTargetValue] = useState("");
  const [comparisonType, setComparisonType] = useState<"min" | "max">("min");
  const [latitude, setLatitude] = useState<string>("");
  const [longitude, setLongitude] = useState<string>("");
  const [radius, setRadius] = useState<string>("");
  const [tokenAddress, setTokenAddress] = useState<string>("");

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");

  const [expirationDate, setExpirationDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);

  const [region, setRegion] = useState({
    latitude: 44.4948,
    longitude: 11.3426,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });
  const [markerPosition, setMarkerPosition] = useState({
    latitude: 44.4948,
    longitude: 11.3426,
  });

  const [locationPermissionStatus, setLocationPermissionStatus] = useState<
    "undetermined" | "granted" | "denied"
  >("undetermined");

  useEffect(() => {
    const fetchLocation = async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermissionStatus(status);

      if (status !== "granted") {
        Alert.alert(
          "Permission denied",
          "Permission to access location was denied. The map will show a default location.",
        );
        return;
      }

      let currentLocation = await Location.getCurrentPositionAsync({});

      const newPosition = {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      };

      setRegion(newPosition);
      setMarkerPosition({
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      });
      setLatitude(currentLocation.coords.latitude.toString());
      setLongitude(currentLocation.coords.longitude.toString());
    };

    fetchLocation();
  }, []);

  useEffect(() => {
    const fetchTokenAddress = async () => {
      const tokenContract = getMyTokenContract();
      if (tokenContract) {
        setTokenAddress(await tokenContract.getAddress());
      }
    };

    fetchTokenAddress();
  }, [getMyTokenContract]);

  const handleMapPress = (e: any) => {
    setMarkerPosition(e.nativeEvent.coordinate);
    setLatitude(e.nativeEvent.coordinate.latitude.toString());
    setLongitude(e.nativeEvent.coordinate.longitude.toString());
  };

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

    if (expirationDate.getTime() <= Date.now()) {
      setErrorMessage("Expiration date must be in the future.");
      setIsLoading(false);
      return;
    }
    const expirationTimestamp = BigInt(
      Math.floor(expirationDate.getTime() / 1000),
    );

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
        comparisonType,
        geoloc,
        formattedPremiumAmount,
        formattedPayoutAmount,
        tokenAddress,
        expirationTimestamp,
      );

      if (deployedInsuranceAddress) {
        setSuccessMessage(
          `Smart insurance created successfully! Address on chain: ${deployedInsuranceAddress}`,
        );
        setInsuredWalletAddress("");
        setPremiumAmount("");
        setPayoutAmount("");
        setSensorType("s4agri:AmbientHumidity");
        setTargetValue("");
        setComparisonType("min");
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
      <SafeAreaView className="flex-1 items-center justify-start pt-8">
        <Text className="text-3xl font-bold mb-6 text-purple-700">
          Create New Insurance
        </Text>
        <ScrollView className="w-full px-8" keyboardShouldPersistTaps="handled">
          <Text className="text-xl font-bold mb-4 text-purple-700 text-center mt-4">
            Policy Details
          </Text>
          <View className="mb-4">
            <Text className="text-sm font-semibold mb-1 text-gray-600">
              INSURED WALLET ADDRESS
            </Text>
            <TextInput
              className="w-full p-3 border border-purple-300 rounded-lg text-base text-gray-800 bg-gray-50 focus:border-purple-500"
              placeholder="0x..."
              placeholderTextColor="#A0AEC0"
              value={insuredWalletAddress}
              onChangeText={setInsuredWalletAddress}
              keyboardType="default"
              autoCapitalize="none"
            />
          </View>

          <View className="mb-4">
            <Text className="text-sm font-semibold mb-1 text-gray-600">
              PREMIUM AMOUNT (IN TOKEN UNITS)
            </Text>
            <TextInput
              className="w-full p-3 border border-purple-300 rounded-lg text-base text-gray-800 bg-gray-50 focus:border-purple-500"
              placeholder="E.g. 10.5"
              placeholderTextColor="#A0AEC0"
              value={premiumAmount}
              onChangeText={setPremiumAmount}
              keyboardType="numeric"
            />
          </View>

          <View className="mb-4">
            <Text className="text-sm font-semibold mb-1 text-gray-600">
              PAYOUT AMOUNT (IN TOKEN UNITS)
            </Text>
            <TextInput
              className="w-full p-3 border border-purple-300 rounded-lg text-base text-gray-800 bg-gray-50 focus:border-purple-500"
              placeholder="E.g. 100"
              placeholderTextColor="#A0AEC0"
              value={payoutAmount}
              onChangeText={setPayoutAmount}
              keyboardType="numeric"
            />
          </View>

          <View className="mb-4">
            <Text className="text-sm font-semibold mb-1 text-gray-600">
              EXPIRATION DATE
            </Text>
            <TouchableOpacity
              onPress={() => setShowDatePicker((prev) => !prev)}
              className="w-full p-3 border border-purple-300 rounded-lg text-base text-gray-800 bg-gray-50 flex-row justify-between items-center"
            >
              <Text>{format(expirationDate, "dd/MM/yyyy")}</Text>

              {showDatePicker && (
                <DateTimePicker
                  testID="dateTimePicker"
                  value={expirationDate}
                  mode="date"
                  display="default"
                  minimumDate={new Date()}
                  onChange={(event, selectedDate) => {
                    const currentDate = selectedDate || expirationDate;
                    setExpirationDate(currentDate);
                  }}
                />
              )}
              <Image
                source={require("../assets/images/calendar-icon.png")}
                className="w-6 h-6"
                resizeMode="contain"
              />
            </TouchableOpacity>
          </View>

          <View className="mb-8 mt-4">
            <Text className="text-sm font-semibold mb-1 text-gray-600">
              TOKEN ADDRESS (ERC-20)
            </Text>
            <TextInput
              className="w-full p-3 border border-gray-300 rounded-lg text-base bg-gray-100 text-gray-500"
              placeholder="0x..."
              placeholderTextColor="#A0AEC0"
              value={tokenAddress}
              editable={false}
            />
          </View>

          <Divider className="my-6" />

          <Text className="text-xl font-bold mb-4 text-purple-700 text-center">
            Geographic Query Details
          </Text>
          <View className="mb-4">
            <Text className="text-sm font-semibold mb-1 text-gray-600">
              SENSOR TYPE
            </Text>
            <View className="flex-row justify-between mt-2">
              <TouchableOpacity
                className={`flex-1 p-3 mr-2 rounded-lg items-center ${
                  sensorType === "s4agri:AmbientHumidity"
                    ? "bg-purple-700 border-purple-700"
                    : "bg-gray-100 border-gray-300"
                } border`}
                onPress={() => setSensorType("s4agri:AmbientHumidity")}
              >
                <Text
                  className={`font-semibold ${
                    sensorType === "s4agri:AmbientHumidity"
                      ? "text-white"
                      : "text-gray-700"
                  }`}
                >
                  Ambient Humidity
                </Text>
                <Text
                  className={`text-xs ${
                    sensorType === "s4agri:AmbientHumidity"
                      ? "text-white/70"
                      : "text-gray-500"
                  }`}
                >
                  (s4agri)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                className={`flex-1 p-3 ml-2 rounded-lg items-center ${
                  sensorType === "saref:Temperature"
                    ? "bg-purple-700 border-purple-700"
                    : "bg-gray-100 border-gray-300"
                } border`}
                onPress={() => setSensorType("saref:Temperature")}
              >
                <Text
                  className={`font-semibold ${
                    sensorType === "saref:Temperature"
                      ? "text-white"
                      : "text-gray-700"
                  }`}
                >
                  Temperature
                </Text>
                <Text
                  className={`text-xs ${
                    sensorType === "saref:Temperature"
                      ? "text-white/70"
                      : "text-gray-500"
                  }`}
                >
                  (saref)
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View className="mb-4">
            <Text className="text-sm font-semibold mb-1 text-gray-600">
              TARGET VALUE (TRIGGER WHEN)
            </Text>
            <View className="flex-row items-center border border-purple-300 rounded-lg overflow-hidden">
              <View className="flex-row items-center bg-gray-100 h-full mx-1">
                <TouchableOpacity
                  className={`p-3 mx-1 items-center rounded-full ${
                    comparisonType === "min"
                      ? "bg-purple-700"
                      : "border border-purple-300"
                  }`}
                  onPress={() => setComparisonType("min")}
                >
                  <Text
                    className={`font-semibold ${
                      comparisonType === "min" ? "text-white" : "text-gray-700"
                    }`}
                  >
                    ≤
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className={`p-3 mx-1 items-center rounded-full ${
                    comparisonType === "max"
                      ? "bg-purple-700"
                      : "border border-purple-300"
                  }`}
                  onPress={() => setComparisonType("max")}
                >
                  <Text
                    className={`font-semibold ${
                      comparisonType === "max" ? "text-white" : "text-gray-700"
                    }`}
                  >
                    ≥
                  </Text>
                </TouchableOpacity>
              </View>
              <TextInput
                className="flex-1 p-3 text-base text-gray-800 bg-gray-50 focus:border-purple-500"
                placeholder="25"
                placeholderTextColor="#A0AEC0"
                value={targetValue}
                onChangeText={setTargetValue}
                keyboardType="numeric"
              />
            </View>
          </View>

          <View className="flex justify-between mb-4">
            <Text className="text-sm font-semibold mb-1 text-gray-600">
              SELECT LOCATION
            </Text>
            <View className="w-full h-80 border border-purple-300 rounded-lg overflow-hidden mb-4">
              <MapView
                style={{ flex: 1 }}
                region={region}
                onRegionChangeComplete={setRegion}
                onPress={handleMapPress}
                showsUserLocation={true}
                mapType={"hybrid"}
                showsMyLocationButton={true}
                {...(Platform.OS === "android" && {
                  provider: PROVIDER_GOOGLE,
                })}
              >
                <Marker
                  coordinate={markerPosition}
                  draggable
                  onDragEnd={(e: any) => handleMapPress(e)}
                />
                {radius && (
                  <Circle
                    center={markerPosition}
                    radius={parseFloat(radius.replace(",", ".") || "0")}
                    fillColor="rgba(107, 70, 193, 0.3)"
                    strokeColor="rgba(107, 70, 193, 0.8)"
                    strokeWidth={2}
                  />
                )}
              </MapView>
            </View>
          </View>
          <View className="mb-4">
            <Text className="text-sm font-semibold mb-1 text-gray-600">
              RADIUS (meters)
            </Text>
            <TextInput
              className="w-full p-3 border border-purple-300 rounded-lg text-base text-gray-800 bg-gray-50 focus:border-purple-500"
              placeholder="e.g., 500"
              placeholderTextColor="#A0AEC0"
              value={radius}
              onChangeText={setRadius}
              keyboardType="numeric"
            />
          </View>

          {isLoading && (
            <View className="flex-row items-center justify-center mb-4 mt-6">
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
            <View className="flex flex-row items-center justify-center mb-4 mt-6">
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
            <View className="flex flex-row items-center justify-center mb-4 mt-6">
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
              className={`bg-purple-700 rounded-full w-[250px] h-[50px] items-center justify-center mt-5 ${isLoading ? "opacity-50" : ""}`}
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
                router.back();
              }}
              className="mt-4"
            >
              <Text className="text-lg font-medium text-blue-500 underline">
                Go to Dashboard
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
        <Modal
          animationType="slide"
          transparent={true}
          visible={deploySmartInsuranceState !== ""}
        >
          <View className="flex-1 justify-center items-center bg-black/60">
            <View className="bg-white p-6 rounded-lg shadow-xl items-center">
              {deploySmartInsuranceState !== "failed" && (
                <ActivityIndicator
                  size="large"
                  color="#6b46c1"
                  className="mb-4"
                />
              )}
              <Text className="text-lg font-bold text-gray-800 text-center">
                {deploySmartInsuranceState === "deploying"
                  ? "Contract deploying"
                  : deploySmartInsuranceState === "approving"
                    ? "Approving"
                    : deploySmartInsuranceState === "paying"
                      ? "Depositing"
                      : "Request has failed. Please retry"}
              </Text>
              {deploySmartInsuranceState !== "failed" ? (
                <Text className="font-light text-purple-700 text-center mt-2">
                  Please wait, processing on blockchain...
                </Text>
              ) : (
                <TouchableOpacity
                  onPress={clearDeployStatus}
                  className="rounded-full bg-purple-700 w-[100px] h-[30px] items-center justify-center mt-5"
                >
                  <Text className="font-bold text-white text-lg">Close</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </TouchableWithoutFeedback>
  );
}
