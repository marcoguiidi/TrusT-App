import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Button,
  Image,
  Alert,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  Platform,
  FlatList, // AGGIUNTO per il supporto della lista
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import { AlertCircle, CheckCircle, Clock } from "lucide-react-native";
import MapView, { Circle, Marker, PROVIDER_GOOGLE } from "react-native-maps";

// Tipi definiti per la gestione multi-sensore
export type ZoniaRequestState =
  | "submitted"
  | "seeded"
  | "ready"
  | "completed"
  | "failed"
  | "initial";
export interface SensorRequestProgress {
  sensorIndex: number;
  sensorQuery: string;
  requestId: string;
  status: ZoniaRequestState;
  result?: string;
  finalCheckSuccess?: boolean; // True solo se checkZoniaData non è revertita
}

interface sensorElement {
  query: string;
  target_value: string;
  comparisonType: string;
  sensor: string;
}

interface SmartInsuranceDetails {
  userWallet: string;
  companyWallet: string;
  premiumAmount: string;
  sensors: sensorElement[]; // Array di sensori
  geoloc: string;
  payoutAmount: string;
  tokenAddress: string;
  currentStatus: number;
  expirationTimestamp: number;
}

interface MapData {
  latitude: number;
  longitude: number;
  radius: number;
}

const StatusMap: { [key: number]: string } = {
  0: "Pending",
  1: "Active",
  2: "Claimed",
  3: "Cancelled",
  4: "Expired",
};

const zoniaStates: ZoniaRequestState[] = [
  "submitted",
  "seeded",
  "ready",
  "completed",
  "failed",
];

const getSensorName = (uri: string) => {
  const parts = uri.split(":");
  return parts.length > 1 ? parts[1].toUpperCase() : uri.toUpperCase();
};

export default function BrowseScreen() {
  const {
    selectedAppRole,
    walletAddress,
    getSmartInsurancesForWallet,
    getDetailForSmartInsurance,
    paySmartInsurancePremium,
    submitZoniaRequest, // Questa funzione ora restituisce Promise<SensorRequestProgress[]>
    paySmartInsurancePayout,
    // Rimossi zoniaRequestState e clearZoniaRequestState
    cancelPolicy,
    canRequestPayout,
  } = useAuth();
  const router = useRouter();

  const [insuranceAddresses, setInsuranceAddresses] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [detailedInsuranceAddress, setDetailedInsuranceAddress] = useState("");
  const [details, setDetails] = useState<SmartInsuranceDetails | null>(null);
  const [isModalLoading, setIsModalLoading] = useState(false);
  const [isPayingPremium, setIsPayingPremium] = useState(false);
  const [isFetchingZonia, setIsFetchingZonia] = useState(false);
  const [key, setKey] = useState(0);
  const [status, setStatus] = useState<"pending" | "active" | "closed">(
    "pending",
  );
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);
  const [mapData, setMapData] = useState<MapData | null>(null);

  // NUOVI STATI PER LA GESTIONE MULTI-SENSORE
  const [allRequestsProgress, setAllRequestsProgress] = useState<
    SensorRequestProgress[]
  >([]);
  const [showZoniaModal, setShowZoniaModal] = useState(false);

  // Variabili derivate per lo stato del processo
  const isZoniaProcessCompleted =
    allRequestsProgress.length > 0 &&
    allRequestsProgress.every(
      (r) => r.status === "completed" || r.status === "failed",
    );

  const allChecksPassed =
    isZoniaProcessCompleted &&
    allRequestsProgress.every((r) => r.finalCheckSuccess === true);

  // Funzione di callback per aggiornare lo stato in tempo reale (passata a submitZoniaRequest)
  const updateProgress = (
    requestId: string,
    newStatus: ZoniaRequestState,
    result?: string,
  ) => {
    setAllRequestsProgress((prev) => {
      if (prev.length === 0) return prev;

      return prev.map((req) => {
        // Solo se l'ID di richiesta è valido (quindi dopo la submission on-chain)
        if (req.requestId && req.requestId === requestId) {
          return {
            ...req,
            status: newStatus,
            result: result || req.result,
          };
        }
        // Gestione del caso iniziale in cui l'ID non è ancora noto
        if (!req.requestId && newStatus === "submitted") {
          // Questo caso è gestito direttamente dalla Promise.all in handleSubmitZonia,
          // ma manteniamo la sicurezza.
          return req;
        }
        return req;
      });
    });
  };

  useEffect(() => {
    setIsLoading(true);
    const fetchInsurances = async () => {
      if (!walletAddress) {
        console.error("Wallet address is missing.");
        setInsuranceAddresses([]);
        setIsLoading(false);
        return;
      }

      if (showZoniaModal) {
        return;
      }

      try {
        const addresses = await getSmartInsurancesForWallet(
          walletAddress,
          status,
        );
        setInsuranceAddresses(addresses);
      } catch (e: any) {
        console.error("Error fetching smart insurances:", e);
        Alert.alert("Error", e);
        setInsuranceAddresses([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInsurances();
  }, [walletAddress, getSmartInsurancesForWallet, key, status, showZoniaModal]);

  useEffect(() => {
    const fetchDetailInsurance = async () => {
      if (!detailedInsuranceAddress) {
        setDetails(null);
        return;
      }

      if (showZoniaModal) {
        return;
      }

      setIsModalLoading(true);
      try {
        const insuranceDetails = await getDetailForSmartInsurance(
          detailedInsuranceAddress,
        );
        // @ts-ignore
        setDetails(insuranceDetails);
      } catch (e) {
        console.error("Error fetching detailed insurance:", e);
        setDetails(null);
        Alert.alert("Error", "Smart Insurance details not available.");
      } finally {
        setIsModalLoading(false);
      }
    };

    fetchDetailInsurance();
  }, [
    detailedInsuranceAddress,
    getDetailForSmartInsurance,
    key,
    showZoniaModal,
  ]);

  const copyToClipboard = async (text: string) => {
    await Clipboard.setStringAsync(text);
    Alert.alert("Copied!", "Address copied to clipboard.");
  };

  const handleSubmitZonia = async () => {
    if (details?.currentStatus !== 1) {
      Alert.alert(
        "Invalid Status",
        "Data check can only be requested for active policies.",
      );
      return;
    }

    // 1. Inizializza lo stato di progresso per la UI
    const initialProgress: SensorRequestProgress[] = details.sensors.map(
      (sensor, index) => ({
        sensorIndex: index,
        sensorQuery: sensor.query,
        requestId: "",
        status: "submitted" as const,
      }),
    );
    setAllRequestsProgress(initialProgress);
    setShowDetailsModal(false);
    setShowZoniaModal(true);

    try {
      setIsFetchingZonia(true);

      // 2. Chiama la funzione con la callback di aggiornamento
      const finalResults = await submitZoniaRequest(
        detailedInsuranceAddress,
        1,
        1,
        10,
        updateProgress, // Passa la callback
      );

      // 3. Aggiorna lo stato finale dopo che tutte le promesse sono risolte
      setAllRequestsProgress(finalResults);
    } catch (e: any) {
      console.error("Errore durante submitZoniaRequest:", e);
      Alert.alert(
        "Error",
        `Zonia Submission Failed: ${e.message || e.toString()}`,
      );

      // Se fallisce, resetta tutto
      setAllRequestsProgress([]);
      setShowZoniaModal(false);
      setShowDetailsModal(true);
    } finally {
      setIsFetchingZonia(false);
    }
  };

  const handleCancelPolicy = async () => {
    if (!detailedInsuranceAddress || !details) {
      return;
    }
    if (details.currentStatus !== 0) {
      Alert.alert(
        "Status not valid",
        `Actual state: ${StatusMap[details.currentStatus]}.`,
      );
      return;
    }

    try {
      await cancelPolicy(detailedInsuranceAddress);
      Alert.alert("Success", "The insurance is cancelled.");

      setKey((prev) => prev + 1);
      setDetailedInsuranceAddress("");
      setDetails(null);
      setShowDetailsModal(false);
    } catch (e: any) {
      console.error("Error:", e);
      Alert.alert("Error", e);
    }
  };

  const handlePayPremium = async () => {
    if (!detailedInsuranceAddress || !details || isPayingPremium) {
      return;
    }

    if (walletAddress?.toLowerCase() !== details.userWallet.toLowerCase()) {
      Alert.alert("Denied", "You are not the Insured wallet.");
      return;
    }

    if (details.currentStatus !== 0) {
      Alert.alert(
        "Status not valid",
        `Actual state: ${StatusMap[details.currentStatus]}.`,
      );
      return;
    }

    setIsPayingPremium(true);
    try {
      await paySmartInsurancePremium(detailedInsuranceAddress);
      Alert.alert("Success", "The insurance is now active.");

      setKey((prev) => prev + 1);
    } catch (error: any) {
      console.error("Error:", error);
      Alert.alert("Error", error);
    } finally {
      setIsPayingPremium(false);
    }
  };

  const handleRequestPayout = async () => {
    if (!allChecksPassed) {
      Alert.alert(
        "Error",
        "All sensor conditions must be successfully verified on-chain before requesting payout.",
      );
      return;
    }

    try {
      await paySmartInsurancePayout(detailedInsuranceAddress);
      Alert.alert("Success", "The payout is received.");

      // Resetta stato e chiudi modale
      setAllRequestsProgress([]);
      setShowZoniaModal(false);

      setKey((prev) => prev + 1);
    } catch (error: any) {
      console.error("Error:", error);
      Alert.alert("Error", error);
    }
  };

  // Funzioni di stile per il progress bar
  const getCircleStyle = (index: number, currentStatus: ZoniaRequestState) => {
    const currentIndex = zoniaStates.indexOf(currentStatus);
    if (index < currentIndex) return "bg-purple-600";
    if (index === currentIndex)
      return "bg-purple-500 shadow-lg shadow-purple-400";
    if (currentStatus === "failed") return "bg-red-500";
    return "bg-gray-300";
  };

  const getLabelStyle = (index: number, currentStatus: ZoniaRequestState) => {
    const currentIndex = zoniaStates.indexOf(currentStatus);
    if (currentStatus === "failed") return "text-red-700 font-bold";
    if (index === currentIndex) return "text-purple-700 font-bold";
    if (index < currentIndex) return "text-gray-500";
    return "text-gray-400";
  };

  // Nuovo componente per renderizzare l'elemento di progresso di un singolo sensore
  const SensorProgressItem = ({ item }: { item: SensorRequestProgress }) => {
    const icon =
      item.status === "completed" && item.finalCheckSuccess ? (
        <CheckCircle size={20} color="#28a745" />
      ) : item.status === "failed" ||
        (item.status === "completed" && !item.finalCheckSuccess) ? (
        <AlertCircle size={20} color="#dc3545" />
      ) : (
        <Clock size={20} color="#ffc107" />
      );

    const statusText =
      item.status === "completed" && item.finalCheckSuccess
        ? "Success (Check On-Chain OK)"
        : item.status === "completed" && !item.finalCheckSuccess
          ? "Completed (Check FAILED)"
          : item.status === "failed"
            ? "Request Failed"
            : "Processing...";

    const statusColor =
      item.status === "completed" && item.finalCheckSuccess
        ? "text-green-700"
        : item.status === "failed" ||
            (item.status === "completed" && !item.finalCheckSuccess)
          ? "text-red-700"
          : "text-orange-600";

    const showSummary = item.status === "completed" || item.status === "failed";

    // Recupera il nome del sensore
    const sensorDetails = details?.sensors[item.sensorIndex];
    const sensorName = sensorDetails
      ? getSensorName(sensorDetails.sensor)
      : `Sensor ${item.sensorIndex + 1}`;

    return (
      <View className="p-3 border border-gray-200 rounded-xl mb-3 bg-white shadow-sm">
        <View className="flex-row items-center justify-between pb-2 border-b border-gray-100">
          <View className="flex-row items-center">
            {icon}
            <Text className="text-base font-bold text-gray-800 ml-2">
              {sensorName}
            </Text>
          </View>
          <Text className={`text-sm font-semibold ${statusColor}`}>
            {statusText}
          </Text>
        </View>

        <View className="w-full pt-2">
          {zoniaStates.map((state, index) => (
            <View key={state} className="flex-row items-center mb-1">
              <View
                className={`w-3 h-3 rounded-full mr-2 ${getCircleStyle(index, item.status)}`}
              />
              <Text className={`text-xs ${getLabelStyle(index, item.status)}`}>
                {state.charAt(0).toUpperCase() + state.slice(1)}
              </Text>
            </View>
          ))}
        </View>

        {showSummary && (
          <View className="w-full bg-gray-50 p-2 rounded-lg mt-2 border border-gray-100">
            <Text className="font-bold text-gray-700 text-sm mb-1">
              Risultato (Raw):
            </Text>
            <ScrollView className="max-h-[60px]">
              <Text className="text-gray-600 text-xs break-words leading-4">
                {item.result ||
                  (item.finalCheckSuccess === false
                    ? "Check On-Chain Reverted"
                    : "N/A")}
              </Text>
            </ScrollView>
          </View>
        )}
      </View>
    );
  };

  const CardView = ({ address }: { address: string }) => {
    return (
      <TouchableOpacity
        onPress={() => {
          setDetailedInsuranceAddress(address);
          setShowDetailsModal(true);
        }}
      >
        <View
          className={`w-[350px] my-2 p-4 rounded-xl flex-row items-center justify-between shadow-lg ${
            selectedAppRole === "user" ? "bg-green-50" : "bg-blue-50"
          }`}
        >
          <View className="flex-row items-center">
            <Image
              source={
                selectedAppRole === "user"
                  ? require("../assets/images/person-icon.png")
                  : require("../assets/images/company-home.jpeg")
              }
              className="w-8 h-8 mr-3"
              resizeMode="contain"
            />
            <Text className="font-bold text-base text-gray-800">
              {`${address.slice(0, 6)}...${address.slice(-4)}`}
            </Text>
          </View>
          <View className="flex-row items-center">
            <Text
              className={`text-sm font-semibold mr-2 ${
                selectedAppRole === "user" ? "text-green-700" : "text-blue-700"
              }`}
            >
              Details
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView className="bg-white h-full items-center justify-start pt-8">
      <View className="w-full flex-row justify-between items-center px-4 mb-8">
        <Text
          onPress={() => router.back()}
          className="text-base font-medium text-blue-500 mb-6"
        >
          ← Home
        </Text>
        <Text
          className={`text-2xl font-bold ${
            selectedAppRole === "user" ? "text-green-500" : "text-blue-500"
          }`}
        >
          Your Insurances
        </Text>
        <View className="w-[50px]" />
      </View>

      <View className="flex flex-row items-center w-full h-[20px] justify-between px-10">
        <TouchableOpacity
          className={`px-1 border-2 border-white ${status == "pending" && `${selectedAppRole === "user" ? "border-b-green-500" : "border-b-blue-500"}`}`}
          onPress={() => {
            if (status !== "pending") setStatus("pending");
          }}
        >
          <Text
            className={`font-medium text-sm ${
              selectedAppRole === "user" ? "text-green-500" : "text-blue-500"
            }`}
          >
            PENDING
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          className={`px-1 border-2 border-white ${status == "active" && `${selectedAppRole === "user" ? "border-b-green-500" : "border-b-blue-500"}`}`}
          onPress={() => {
            if (status !== "active") setStatus("active");
          }}
        >
          <Text
            className={`font-medium text-sm ${
              selectedAppRole === "user" ? "text-green-500" : "text-blue-500"
            }`}
          >
            ACTIVE
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          className={`px-1 border-2 border-white ${status == "closed" && `${selectedAppRole === "user" ? "border-b-green-500" : "border-b-blue-500"}`}`}
          onPress={() => {
            if (status !== "closed") setStatus("closed");
          }}
        >
          <Text
            className={`font-medium text-sm ${
              selectedAppRole === "user" ? "text-green-500" : "text-blue-500"
            }`}
          >
            CLOSED
          </Text>
        </TouchableOpacity>
      </View>
      <ScrollView
        className="h-full w-full"
        contentContainerStyle={{ alignItems: "center", paddingVertical: 20 }}
      >
        {isLoading && !showZoniaModal ? (
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
        visible={showDetailsModal}
        onRequestClose={() => {
          setDetailedInsuranceAddress("");
          setDetails(null);
          setShowDetailsModal(false);
        }}
      >
        <View className="flex-1 justify-center items-center bg-black/60 p-2">
          <View className="bg-white rounded-3xl p-6 items-center shadow-2xl w-full max-w-md max-h-[95%]">
            <ScrollView className="w-full">
              <View className="items-center mb-1">
                <Text className="text-3xl font-extrabold text-purple-800 text-center">
                  Smart Insurance Details
                </Text>
                <View className="flex-row items-center bg-gray-100 rounded-full px-4 py-2">
                  <Text className="text-sm font-medium text-gray-600 mr-2">
                    Contract ID:
                  </Text>
                  <TouchableOpacity
                    className="flex-row items-center"
                    onPress={() => copyToClipboard(detailedInsuranceAddress)}
                  >
                    <Text className="text-sm font-bold text-purple-600 underline">
                      {`${detailedInsuranceAddress.slice(0, 6)}...${detailedInsuranceAddress.slice(-4)}`}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {isModalLoading ? (
                <ActivityIndicator
                  size="large"
                  color="#6b46c1"
                  className="my-10"
                />
              ) : details ? (
                <>
                  <View className="w-full mb-3">
                    <View className="flex-row justify-between items-center bg-purple-50 p-2 rounded-xl mb-2">
                      <Text className="text-base font-semibold text-purple-700">
                        Premium
                      </Text>
                      <Text className="text-xl font-bold text-purple-900">
                        {details.premiumAmount} TTK
                      </Text>
                    </View>
                    <View className="flex-row justify-between items-center bg-green-50 p-4 rounded-xl mb-2">
                      <Text className="text-base font-semibold text-green-700">
                        Payout
                      </Text>
                      <Text className="text-xl font-bold text-green-900">
                        {details.payoutAmount} TTK
                      </Text>
                    </View>
                    <View className="flex-row justify-between items-center bg-yellow-50 p-4 rounded-xl">
                      <Text className="text-base font-semibold text-yellow-700">
                        Status
                      </Text>
                      <Text
                        className={`text-xl font-bold ${
                          StatusMap[details.currentStatus] === "Active"
                            ? "text-green-600"
                            : StatusMap[details.currentStatus] === "Pending"
                              ? "text-gray-600"
                              : "text-red-600"
                        }`}
                      >
                        {StatusMap[details.currentStatus]}
                      </Text>
                    </View>
                  </View>
                  <View className="w-full border-t border-gray-200 pt-1">
                    <View className="flex-row items-center justify-between py-2 border-b border-gray-100">
                      <View className="flex-row items-center">
                        <Image
                          source={
                            selectedAppRole === "company"
                              ? require("../assets/images/purple-person-icon.png")
                              : require("../assets/images/purple-company-icon.png")
                          }
                          className="w-5 h-5 mr-3"
                          resizeMode="contain"
                        />
                        <Text className="text-sm font-medium text-gray-700">
                          {selectedAppRole === "user"
                            ? "Company Wallet"
                            : "Insured Wallet"}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() =>
                          copyToClipboard(
                            selectedAppRole === "user"
                              ? details.companyWallet
                              : details.userWallet,
                          )
                        }
                      >
                        <Text className="text-sm font-bold text-blue-500 underline">
                          {selectedAppRole === "user"
                            ? `${details.companyWallet.slice(0, 6)}...${details.companyWallet.slice(-4)}`
                            : `${details.userWallet.slice(0, 6)}...${details.userWallet.slice(-4)}`}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <View className="flex-row items-center justify-between py-2 border-b border-gray-100">
                      <View className="flex-row items-center">
                        <Image
                          source={require("../assets/images/calendar-icon.png")}
                          className="w-5 h-5 mr-3"
                          resizeMode="contain"
                        />
                        <Text className="text-sm font-medium text-gray-700">
                          Expiration
                        </Text>
                      </View>
                      <Text className="text-sm font-bold text-gray-800">
                        {new Date(
                          details.expirationTimestamp * 1000,
                        ).toLocaleDateString()}
                      </Text>
                    </View>

                    <View className="w-full pt-2">
                      <Text className="text-base font-semibold text-gray-800 mb-2">
                        Sensor Conditions ({details.sensors.length})
                      </Text>
                      {details.sensors.map((sensor, index) => (
                        <View
                          key={index}
                          className="border border-purple-200 rounded-lg p-3 mb-2 bg-purple-50"
                        >
                          <View className="flex-row items-center justify-between pb-1">
                            <View className="flex-row items-center">
                              <Image
                                source={require("../assets/images/sensor-icon.png")}
                                className="w-4 h-4 mr-2"
                                resizeMode="contain"
                              />
                              <Text className="text-xs font-semibold text-purple-700">
                                Sensor {index + 1}
                              </Text>
                            </View>
                            <Text className="text-sm font-bold text-purple-900">
                              {getSensorName(sensor.sensor)}
                            </Text>
                          </View>
                          <View className="flex-row items-center justify-between pt-1 border-t border-purple-100">
                            <Text className="text-xs font-medium text-gray-600">
                              Target:
                            </Text>
                            <Text className="text-sm font-bold text-gray-800">
                              {sensor.comparisonType === "min" ? "≤" : "≥"}{" "}
                              {sensor.target_value}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>

                    <View className="flex-row items-center justify-between py-2 border-b border-gray-100 mt-2">
                      <View className="flex-row items-center">
                        <Image
                          source={require("../assets/images/token-icon.png")}
                          className="w-5 h-5 mr-3"
                          resizeMode="contain"
                        />
                        <Text className="text-sm font-medium text-gray-700">
                          Token
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => copyToClipboard(details.tokenAddress)}
                      >
                        <Text className="text-sm font-bold text-blue-500 underline">
                          {`${details.tokenAddress.slice(0, 6)}...${details.tokenAddress.slice(-4)}`}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <View className="flex-row items-center justify-between py-2">
                      <View className="flex-row items-center">
                        <Image
                          source={require("../assets/images/purple_map_icon.png")}
                          className="w-5 h-5 mr-3"
                          resizeMode="contain"
                        />
                        <Text className="text-sm font-medium text-gray-700">
                          Location
                        </Text>
                      </View>
                      <TouchableOpacity
                        className="bg-purple-100 rounded-full p-2"
                        onPress={() => {
                          const regex =
                            /lat: ([\d.-]+), lon: ([\d.-]+), radius: ([\d.-]+) m/;
                          const match = details.geoloc.match(regex);

                          if (match) {
                            const lat = parseFloat(match[1]);
                            const lon = parseFloat(match[2]);
                            const rad = parseFloat(match[3]);

                            setMapData({
                              latitude: lat,
                              longitude: lon,
                              radius: rad,
                            });
                            setShowDetailsModal(false);
                            setShowMapModal(true);
                          } else {
                            Alert.alert(
                              "Error",
                              "Invalid geographic data. Check the format.",
                            );
                          }
                        }}
                      >
                        <Image
                          source={require("../assets/images/purple_map_icon.png")}
                          resizeMode="contain"
                          className="w-6 h-6"
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View className="w-full mt-2">
                    {details.currentStatus === 0 &&
                      walletAddress?.toLowerCase() ===
                        details.userWallet.toLowerCase() && (
                        <TouchableOpacity
                          onPress={handlePayPremium}
                          className={`bg-green-500 self-center rounded-full w-full h-12 items-center justify-center mb-3 ${isPayingPremium ? "opacity-50" : ""}`}
                          disabled={isPayingPremium}
                        >
                          {isPayingPremium ? (
                            <ActivityIndicator size="small" color="#ffffff" />
                          ) : (
                            <Text className="text-white font-bold text-lg">
                              Pay Premium
                            </Text>
                          )}
                        </TouchableOpacity>
                      )}
                    {details.currentStatus === 0 && (
                      <TouchableOpacity
                        onPress={handleCancelPolicy}
                        className={`bg-red-500 self-center rounded-full w-full h-12 items-center justify-center mb-3`}
                      >
                        <Text className="text-white font-bold text-lg">
                          Cancel Policy
                        </Text>
                      </TouchableOpacity>
                    )}
                    {details.currentStatus === 1 && (
                      <TouchableOpacity
                        onPress={handleSubmitZonia}
                        className={`bg-purple-600 self-center rounded-full w-full h-12 items-center justify-center mb-3 ${isFetchingZonia ? "opacity-50" : ""}`}
                        disabled={isFetchingZonia}
                      >
                        {isFetchingZonia ? (
                          <ActivityIndicator size="small" color="#ffffff" />
                        ) : (
                          <Text className="text-white font-bold text-lg">
                            Check Data
                          </Text>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                </>
              ) : (
                <Text className="text-base text-gray-600 text-center mb-5">
                  No details found.
                </Text>
              )}
              <TouchableOpacity
                onPress={() => {
                  setDetailedInsuranceAddress("");
                  setDetails(null);
                  setShowDetailsModal(false);
                }}
                className="bg-gray-200 self-center rounded-full w-full h-12 items-center justify-center"
              >
                <Text className="text-gray-700 font-bold text-lg">Close</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal animationType="fade" transparent={true} visible={showZoniaModal}>
        <View className="flex-1 justify-center items-center bg-black/60 p-4">
          <View className="m-4 bg-white rounded-3xl p-8 items-center shadow-2xl shadow-gray-400 w-full max-w-md">
            <View className="flex-row items-center justify-center mb-6">
              {isZoniaProcessCompleted && allChecksPassed && (
                <>
                  <CheckCircle size={36} color="#28a745" />
                  <Text className="text-2xl text-green-700 font-bold ml-3">
                    All Checks Success!
                  </Text>
                </>
              )}
              {isZoniaProcessCompleted && !allChecksPassed && (
                <>
                  <AlertCircle size={36} color="#dc3545" />
                  <Text className="text-2xl text-red-700 font-bold ml-3">
                    One or More Checks Failed!
                  </Text>
                </>
              )}
              {!isZoniaProcessCompleted && (
                <>
                  <Clock size={36} color="#ffc107" />
                  <Text className="text-2xl text-orange-600 font-bold ml-3">
                    Processing ...
                  </Text>
                </>
              )}
            </View>

            <Text className="text-3xl font-extrabold text-indigo-800 mb-6 text-center">
              Zonia Status ({allRequestsProgress.length} Sensors)
            </Text>

            {/* Lista dei progressi dei sensori */}
            <FlatList
              data={allRequestsProgress}
              renderItem={SensorProgressItem}
              keyExtractor={(item) =>
                item.requestId || item.sensorIndex.toString()
              }
              className="w-full max-h-[350px] mb-6 border-t border-b border-gray-200 py-4"
              ListEmptyComponent={
                <View className="flex-1 items-center justify-center pt-8">
                  <ActivityIndicator size="large" color="#6b46c1" />
                  <Text className="text-center text-gray-500 mt-2">
                    Submitting requests...
                  </Text>
                </View>
              }
            />

            {/* Pulsante Request Payout (Visibile solo se tutti i check sono OK) */}
            {isZoniaProcessCompleted &&
              allChecksPassed &&
              details &&
              walletAddress?.toLowerCase() ===
                details.userWallet.toLowerCase() &&
              canRequestPayout && (
                <TouchableOpacity
                  onPress={handleRequestPayout}
                  className={`mt-5 bg-green-500 self-center rounded-full w-full h-12 items-center justify-center`}
                >
                  <Text className="text-white font-bold text-lg">
                    Request Payout
                  </Text>
                </TouchableOpacity>
              )}

            {/* Pulsante Close (Visibile solo quando l'intero processo è terminato) */}
            {isZoniaProcessCompleted && (
              <TouchableOpacity
                onPress={() => {
                  setAllRequestsProgress([]); // Resetta lo stato di progresso
                  setShowDetailsModal(true);
                  setShowZoniaModal(false);
                  setKey((prev) => prev + 1);
                }}
                className="mt-4 bg-purple-600 px-6 py-3 rounded-full shadow-md shadow-purple-400"
              >
                <Text className="text-white font-bold text-lg">Close</Text>
              </TouchableOpacity>
            )}

            {/* Loading durante il fetching Zonia/Check */}
            {isFetchingZonia && !isZoniaProcessCompleted && (
              <View className="mt-4">
                <ActivityIndicator size="large" color="#6b46c1" />
                <Text className="text-gray-500 mt-2">
                  Waiting for confirmations...
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        transparent={true}
        visible={showMapModal}
        onRequestClose={() => {
          setShowMapModal(false);
          setMapData(null);
          setShowDetailsModal(true);
        }}
      >
        <View className="flex-1 justify-center items-center bg-black/60">
          <View className="m-5 bg-white rounded-2xl p-6 items-center shadow-xl w-[90%] h-[70%]">
            <Text className="text-2xl font-bold text-gray-700 mb-4">
              Location Details
            </Text>
            {mapData ? (
              <View className="w-full h-4/5">
                <MapView
                  style={{
                    flex: 1,
                    borderRadius: 12,
                    borderColor: "#d1d5db",
                    borderWidth: 1,
                  }}
                  initialRegion={{
                    latitude: mapData.latitude,
                    longitude: mapData.longitude,
                    latitudeDelta: 0.05,
                    longitudeDelta: 0.05,
                  }}
                  mapType={"hybrid"}
                  {...(Platform.OS === "android" && {
                    provider: PROVIDER_GOOGLE,
                  })}
                >
                  <Marker
                    coordinate={{
                      latitude: mapData.latitude,
                      longitude: mapData.longitude,
                    }}
                  />
                  <Circle
                    center={{
                      latitude: mapData.latitude,
                      longitude: mapData.longitude,
                    }}
                    radius={mapData.radius}
                    fillColor="rgba(107, 70, 193, 0.3)"
                    strokeColor="rgba(107, 70, 193, 0.8)"
                    strokeWidth={2}
                  />
                </MapView>
              </View>
            ) : (
              <View className="w-full h-4/5 items-center justify-center">
                <ActivityIndicator size="large" color="#6b46c1" />
                <Text className="text-gray-600 mt-4">Map loading...</Text>
              </View>
            )}
            <TouchableOpacity
              className="mt-5 bg-purple-600 px-6 py-3 rounded-full shadow-md shadow-purple-400"
              onPress={() => {
                setShowMapModal(false);
                setMapData(null);
                setShowDetailsModal(true);
              }}
            >
              <Text className="text-white font-bold text-lg">Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
