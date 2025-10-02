import React, { useEffect, useState, useCallback, useMemo } from "react";
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

interface Sensor {
  sensor: "s4agri:AmbientHumidity" | "saref:Temperature";
  targetValue: string;
  comparisonType: "min" | "max";
}

interface sensorElement {
  query: string;
  target_value: string;
  comparisonType: string;
  sensor: string;
}

const SENSOR_OPTIONS = [
  { label: "Ambient Humidity", key: "s4agri:AmbientHumidity", short: "s4agri" },
  { label: "Temperature", key: "saref:Temperature", short: "saref" },
];

interface SensorInputProps {
  sensor: Sensor;
  setSensor: React.Dispatch<React.SetStateAction<Sensor | null>>;
  onRemove: (isOnlySensor: boolean) => void;
  index: number;
  allSensors: (Sensor | null)[];
}

const SensorInput: React.FC<SensorInputProps> = ({
  sensor,
  setSensor,
  onRemove,
  index,
  allSensors,
}) => {
  const isOnlySensor = allSensors.filter(Boolean).length === 1;

  const usedSensorType = useMemo(() => {
    return allSensors.find((s, i) => s !== null && i !== index)?.sensor;
  }, [allSensors, index]);

  const handleTypeChange = (key: Sensor["sensor"]) => {
    if (key === usedSensorType) return;
    setSensor((prev) => (prev ? { ...prev, sensor: key } : null));
  };

  const handleComparisonChange = (type: "min" | "max") => {
    setSensor((prev) => (prev ? { ...prev, comparisonType: type } : null));
  };

  const handleTargetValueChange = (value: string) => {
    setSensor((prev) => (prev ? { ...prev, targetValue: value } : null));
  };

  return (
    <View className="p-4 border border-purple-300 rounded-lg mb-6 bg-purple-50">
      <View className="flex-row justify-between items-center mb-4">
        <Text className="text-lg font-bold text-purple-700">
          Sensor {index + 1}
        </Text>
        <TouchableOpacity
          onPress={() => onRemove(isOnlySensor)}
          className={`p-1 ${isOnlySensor ? "opacity-30" : ""}`}
          disabled={isOnlySensor}
        >
          <Text
            className={`font-semibold ${isOnlySensor ? "text-gray-500" : "text-red-500"}`}
          >
            X
          </Text>
        </TouchableOpacity>
      </View>

      <Text className="text-sm font-semibold mb-1 text-gray-600">
        SENSOR TYPE
      </Text>
      <View className="flex-row justify-between mt-2 mb-4">
        {SENSOR_OPTIONS.map((opt) => {
          const isUsedByOther = opt.key === usedSensorType;
          return (
            <TouchableOpacity
              key={opt.key}
              className={`flex-1 p-3 mx-1 rounded-lg items-center ${
                sensor.sensor === opt.key
                  ? "bg-purple-700 border-purple-700"
                  : isUsedByOther
                    ? "bg-gray-200 border-gray-200 opacity-60"
                    : "bg-gray-100 border-gray-300"
              } border`}
              onPress={() => handleTypeChange(opt.key as Sensor["sensor"])}
              disabled={isUsedByOther}
            >
              <Text
                className={`font-semibold text-center ${
                  sensor.sensor === opt.key ? "text-white" : "text-gray-700"
                }`}
              >
                {opt.label}
              </Text>
              <Text
                className={`text-xs ${
                  sensor.sensor === opt.key ? "text-white/70" : "text-gray-500"
                }`}
              >
                ({opt.short})
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text className="text-sm font-semibold mb-1 text-gray-600">
        TARGET VALUE (TRIGGER WHEN)
      </Text>
      <View className="flex-row items-center border border-purple-300 rounded-lg overflow-hidden">
        <View className="flex-row items-center bg-gray-100 h-full mx-1">
          <TouchableOpacity
            className={`p-3 mx-1 items-center rounded-full ${
              sensor.comparisonType === "min"
                ? "bg-purple-700"
                : "border border-purple-300"
            }`}
            onPress={() => handleComparisonChange("min")}
          >
            <Text
              className={`font-bold text-lg ${
                sensor.comparisonType === "min" ? "text-white" : "text-gray-700"
              }`}
            >
              {"\u2264"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className={`p-3 mx-1 items-center rounded-full ${
              sensor.comparisonType === "max"
                ? "bg-purple-700"
                : "border border-purple-300"
            }`}
            onPress={() => handleComparisonChange("max")}
          >
            <Text
              className={`font-bold text-lg ${
                sensor.comparisonType === "max" ? "text-white" : "text-gray-700"
              }`}
            >
              {"\u2265"}
            </Text>
          </TouchableOpacity>
        </View>
        <TextInput
          className="flex-1 p-3 text-base text-gray-800 bg-gray-50 focus:border-purple-500"
          placeholder="e.g. 25"
          placeholderTextColor="#A0AEC0"
          value={sensor.targetValue}
          onChangeText={handleTargetValueChange}
          keyboardType="numeric"
        />
      </View>
    </View>
  );
};

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

  const [sensor1, setSensor1] = useState<Sensor | null>({
    sensor: "s4agri:AmbientHumidity",
    targetValue: "",
    comparisonType: "min",
  });
  const [sensor2, setSensor2] = useState<Sensor | null>(null);

  const allSensors = [sensor1, sensor2];

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

  const handleDateChange = (event: any, selectedDate: Date | undefined) => {
    const currentDate = selectedDate || expirationDate;
    setShowDatePicker(Platform.OS === "ios");
    setExpirationDate(currentDate);
  };

  const handleAddSensor = () => {
    if (sensor1 && !sensor2) {
      const sensor1Type = sensor1.sensor;
      const newSensorType =
        SENSOR_OPTIONS.find((opt) => opt.key !== sensor1Type)?.key ||
        SENSOR_OPTIONS[0].key;

      setSensor2({
        sensor: newSensorType as Sensor["sensor"],
        targetValue: "",
        comparisonType: "min",
      });
    } else if (!sensor1) {
      setSensor1({
        sensor: "s4agri:AmbientHumidity",
        targetValue: "",
        comparisonType: "min",
      });
    }
  };

  const handleRemoveSensor = useCallback(
    (indexToRemove: number) => (isOnlySensor: boolean) => {
      if (isOnlySensor) {
        if (indexToRemove === 0 && sensor1) {
          setSensor1({
            sensor: "s4agri:AmbientHumidity",
            targetValue: "",
            comparisonType: "min",
          });
        } else if (indexToRemove === 1 && sensor2) {
          setSensor2(null);
        }
        return;
      }

      if (indexToRemove === 0) {
        setSensor1(sensor2);
        setSensor2(null);
      } else if (indexToRemove === 1) {
        setSensor2(null);
      }
    },
    [sensor1, sensor2],
  );

  const generateSensorElements = (
    latNum: number,
    lonNum: number,
    radNum: number,
  ): sensorElement[] => {
    const activeSensors: Sensor[] = [sensor1, sensor2].filter(
      (s): s is Sensor => s !== null,
    );

    return activeSensors.map((s) => {
      const queryJson = {
        topic: s.sensor,
        geo: {
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [lonNum, latNum],
          },
          properties: {
            radius: radNum,
          },
        },
      };

      return {
        query: JSON.stringify(queryJson),
        target_value: s.targetValue,
        comparisonType: s.comparisonType,
        sensor: s.sensor,
      };
    });
  };

  const handleSubmit = async () => {
    setErrorMessage("");
    setSuccessMessage("");
    setIsLoading(true);

    const formattedPremiumAmount = premiumAmount.replace(",", ".");
    const formattedPayoutAmount = payoutAmount.replace(",", ".");
    const latNum = parseFloat(latitude.replace(",", "."));
    const lonNum = parseFloat(longitude.replace(",", "."));
    const radNum = parseFloat(radius.replace(",", "."));

    const activeSensors = [sensor1, sensor2].filter(
      (s) => s !== null,
    ) as Sensor[];

    if (activeSensors.length === 0) {
      setErrorMessage("At least one sensor is required.");
      setIsLoading(false);
      return;
    }

    if (sensor1 && sensor2 && sensor1.sensor === sensor2.sensor) {
      setErrorMessage(
        "If two sensors are used, they must be of different types (e.g., Humidity AND Temperature).",
      );
      setIsLoading(false);
      return;
    }

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
    if (expirationDate.getTime() <= Date.now()) {
      setErrorMessage("Expiration date must be in the future.");
      setIsLoading(false);
      return;
    }
    if (!ethers.isAddress(tokenAddress)) {
      setErrorMessage("Token address not valid.");
      setIsLoading(false);
      return;
    }

    for (const sensor of activeSensors) {
      const targetValueNum = parseFloat(sensor.targetValue.replace(",", "."));
      if (isNaN(targetValueNum)) {
        setErrorMessage(`Target value for ${sensor.sensor} is not valid.`);
        setIsLoading(false);
        return;
      }
    }

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

    const expirationTimestamp = BigInt(
      Math.floor(expirationDate.getTime() / 1000),
    );
    const geoloc = `lat: ${latNum}, lon: ${lonNum}, radius: ${radNum} m`;
    const sensorsData = generateSensorElements(latNum, lonNum, radNum);

    try {
      const companyWalletAddress = walletAddress || "";
      if (!companyWalletAddress) {
        setErrorMessage(
          "Company wallet address not available. Please connect your wallet.",
        );
        setIsLoading(false);
        return;
      }

      const deployedInsuranceAddress = await createSmartInsurance(
        insuredWalletAddress,
        sensorsData,
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
        setSensor1({
          sensor: "s4agri:AmbientHumidity",
          targetValue: "",
          comparisonType: "min",
        });
        setSensor2(null);
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
                  onChange={handleDateChange}
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
              value={tokenAddress}
              editable={false}
            />
          </View>

          <Divider className="my-6" />
          <Text className="text-xl font-bold mb-4 text-purple-700 text-center">
            Sensor Conditions (Max 2)
          </Text>

          {sensor1 && (
            <SensorInput
              sensor={sensor1}
              setSensor={setSensor1}
              onRemove={handleRemoveSensor(0)}
              index={0}
              allSensors={allSensors}
            />
          )}

          {sensor2 && (
            <SensorInput
              sensor={sensor2}
              setSensor={setSensor2}
              onRemove={handleRemoveSensor(1)}
              index={1}
              allSensors={allSensors}
            />
          )}

          <View className="justify-center items-center mb-6">
            <TouchableOpacity
              onPress={handleAddSensor}
              disabled={!!sensor2}
              className={`bg-purple-500 rounded-full w-[250px] h-[40px] items-center justify-center ${
                !!sensor2 ? "opacity-50" : ""
              }`}
            >
              <Text className="text-white font-bold text-lg">
                Add Sensor ({[sensor1, sensor2].filter(Boolean).length}/2)
              </Text>
            </TouchableOpacity>
          </View>

          <Divider className="my-6" />

          <Text className="text-xl font-bold mb-4 text-purple-700 text-center">
            Geographic Details
          </Text>

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
