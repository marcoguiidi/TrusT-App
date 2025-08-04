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
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import { AlertCircle, CheckCircle, Clock } from "lucide-react-native";
import MapView, { Circle, Marker } from "react-native-maps";

interface SmartInsuranceDetails {
  userWallet: string;
  companyWallet: string;
  premiumAmount: string;
  query: string;
  sensor: string;
  target_value: number;
  geoloc: string;
  payoutAmount: string;
  tokenAddress: string;
  currentStatus: number;
  expirationTimestamp: number;
}

const StatusMap: { [key: number]: string } = {
  0: "Pending",
  1: "Active",
  2: "Claimed",
  3: "Cancelled",
  4: "Expired",
};

const zoniaStates = [
  "pending",
  "submitted",
  "seeded",
  "ready",
  "completed",
  "failed",
];

export default function BrowseScreen() {
  const {
    selectedAppRole,
    walletAddress,
    getSmartInsurancesForWallet,
    getDetailForSmartInsurance,
    paySmartInsurancePremium,
    submitZoniaRequest,
    paySmartInsurancePayout,
    zoniaRequestState,
    clearZoniaRequestState,
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
  const [resultZonia, setResultZonia] = useState<string | undefined>("");
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showZoniaModal, setShowZoniaModal] = useState(
    zoniaRequestState != null,
  );
  const currentIndex = zoniaRequestState
    ? zoniaStates.indexOf(zoniaRequestState)
    : -1;

  const [showMapModal, setShowMapModal] = useState(false);
  const [mapData, setMapData] = useState<{
    latitude: number;
    longitude: number;
    radius: number;
  } | null>(null);

  useEffect(() => {
    setIsLoading(true);
    const fetchInsurances = async () => {
      if (!walletAddress) {
        console.error("Wallet address is missing.");
        setInsuranceAddresses([]);
        setIsLoading(false);
        return;
      }

      if (zoniaRequestState) {
        return;
      }

      try {
        const addresses = await getSmartInsurancesForWallet(
          walletAddress,
          status,
        );
        setInsuranceAddresses(addresses);
      } catch (e) {
        console.error("Error fetching smart insurances:", e);
        setInsuranceAddresses([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInsurances();
  }, [walletAddress, getSmartInsurancesForWallet, key, status]);

  useEffect(() => {
    const fetchDetailInsurance = async () => {
      if (!detailedInsuranceAddress) {
        setDetails(null);
        return;
      }

      if (zoniaRequestState) {
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
        Alert.alert("Errore", "Impossibile caricare i dettagli della polizza.");
      } finally {
        setIsModalLoading(false);
      }
    };

    fetchDetailInsurance();
  }, [detailedInsuranceAddress, getDetailForSmartInsurance, key]);

  useEffect(() => {
    if (zoniaRequestState != null) {
      setShowDetailsModal(false);
      setShowZoniaModal(true);
    }
  }, [zoniaRequestState]);

  const copyToClipboard = async (text: string) => {
    await Clipboard.setStringAsync(text);
    Alert.alert("Copied!", "Address copied to clipboard.");
  };

  const handleSubmitZonia = async () => {
    try {
      setIsFetchingZonia(true);
      const result = await submitZoniaRequest(
        detailedInsuranceAddress,
        1,
        1,
        10,
      );
      setResultZonia(result);
    } catch (e: any) {
      setResultZonia(e.toString());
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
    } catch (e: any) {
      console.error("Error:", e);
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
    } finally {
      setIsPayingPremium(false);
    }
  };

  const handleRequestPayout = async () => {
    try {
      await paySmartInsurancePayout(detailedInsuranceAddress);
      Alert.alert("Success", "The payout is received.");
      setKey((prev) => prev + 1);
    } catch (error: any) {
      console.error("Error:", error);
    }
  };

  const getCircleStyle = (index: number) => {
    if (index < currentIndex) return "bg-purple-600";
    if (index === currentIndex)
      return "bg-purple-500 shadow-lg shadow-purple-400";
    return "bg-gray-300";
  };

  const getLabelStyle = (index: number) => {
    if (index === currentIndex) return "text-purple-700 font-bold";
    if (index < currentIndex) return "text-gray-500";
    return "text-gray-400";
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
      <Text
        className={`text-2xl font-bold mb-6 ${
          selectedAppRole === "user" ? "text-green-500" : "text-blue-500"
        }`}
      >
        Your Insurances
      </Text>

      <Text
        onPress={() => {
          router.replace("/dashboard");
        }}
        className={"text-lg font-medium text-blue-300 mb-4"}
      >
        Home
      </Text>
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
        {isLoading && !zoniaRequestState ? (
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
        <View className="flex-1 justify-center items-center bg-black/60">
          <View className="m-5 bg-white rounded-2xl p-9 items-center shadow-xl w-[90%] max-h-[80%] justify-center">
            <Text className="text-2xl font-bold text-gray-700">
              Smart Insurance Details
            </Text>
            <TouchableOpacity
              className="self-center mb-5"
              onPress={() => copyToClipboard(detailedInsuranceAddress)}
            >
              <Text className="text-base self-center text-gray-500 underline flex-2 text-right">
                {`${detailedInsuranceAddress.slice(0, 8)}...${detailedInsuranceAddress.slice(-6)}`}
              </Text>
            </TouchableOpacity>

            {isModalLoading ? (
              <ActivityIndicator
                size="large"
                color="#6b46c1"
                className="mt-5"
              />
            ) : details ? (
              <ScrollView className="w-full mb-5">
                {selectedAppRole === "user" ? (
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
                ) : (
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
                )}
                <View className="flex-row justify-between items-center mb-2.5 py-1.5 border-b border-gray-200">
                  <Text className="text-base font-semibold text-purple-700 flex-1">
                    Premium Amount:
                  </Text>
                  <Text className="text-base text-gray-700 flex-2 text-right">
                    {details.premiumAmount} (TTK)
                  </Text>
                </View>

                <View className="flex-row justify-between items-center mb-2.5 py-1.5 border-b border-gray-200">
                  <Text className="text-base font-semibold text-purple-700 flex-1">
                    Payout Amount:
                  </Text>
                  <Text className="text-base text-gray-700 flex-2 text-right">
                    {details.payoutAmount} (TTK)
                  </Text>
                </View>

                <View className="flex-row justify-between items-center mb-2.5 py-1.5 border-b border-gray-200">
                  <Text className="text-base font-semibold text-purple-700 flex-1">
                    Sensor:
                  </Text>
                  <Text className="text-base text-gray-700 flex-2 text-right">
                    {details.sensor}
                  </Text>
                </View>

                <View className="flex-row justify-between items-center mb-2.5 py-1.5 border-b border-gray-200">
                  <Text className="text-base font-semibold text-purple-700 flex-1">
                    Target Value:
                  </Text>
                  <Text className="text-base text-gray-700 flex-2 text-right">
                    {details.target_value}
                  </Text>
                </View>

                <View className="flex-row justify-between items-center mb-2.5 py-1.5 border-b border-gray-200">
                  <Text className="text-base font-semibold text-purple-700 flex-1">
                    Geo Data:
                  </Text>
                  {details && (
                    <TouchableOpacity
                      className="p-2 rounded-full self-center"
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
                            "Errore",
                            "Dati geografici non validi. Controlla il formato.",
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
                  )}
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
                  <Text
                    className={`text-base flex-2 font-bold text-right ${
                      StatusMap[details.currentStatus] == "Active"
                        ? "text-green-700"
                        : `${
                            StatusMap[details.currentStatus] == "Cancelled" ||
                            StatusMap[details.currentStatus] == "Expired"
                              ? "text-red-700"
                              : `${
                                  StatusMap[details.currentStatus] == "Claimed"
                                    ? "text-yellow-500"
                                    : "text-gray-700"
                                }`
                          }`
                    }`}
                  >
                    {StatusMap[details.currentStatus] || "Unknown"}
                  </Text>
                </View>

                <View className="flex-row justify-between items-center mb-2.5 py-1.5 border-b border-gray-200">
                  <Text className="text-base font-semibold text-purple-700 flex-1">
                    Expiration (MM/DD/YYYY):
                  </Text>
                  <Text className="text-base text-gray-700 flex-2 text-right">
                    {details &&
                      new Date(
                        details.expirationTimestamp * 1000,
                      ).toLocaleDateString()}
                  </Text>
                </View>

                {details.currentStatus === 0 &&
                  walletAddress?.toLowerCase() ===
                    details.userWallet.toLowerCase() && (
                    <TouchableOpacity
                      onPress={handlePayPremium}
                      className={`mt-5 bg-green-500 self-center rounded-full w-[200px] h-[45px] items-center justify-center ${isPayingPremium ? "opacity-50" : ""}`}
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
                    className={`mt-5 bg-red-500 self-center rounded-full w-[200px] h-[45px] items-center justify-center ${isPayingPremium ? "opacity-50" : ""}`}
                  >
                    <Text className="text-white font-bold text-lg">
                      Cancel Policy
                    </Text>
                  </TouchableOpacity>
                )}
                {details.currentStatus === 1 && (
                  // walletAddress?.toLowerCase() === details.userWallet.toLowerCase() &&
                  <TouchableOpacity
                    onPress={handleSubmitZonia}
                    className={`mt-5 bg-green-500 self-center rounded-full w-[200px] h-[45px] items-center justify-center ${isFetchingZonia ? "opacity-50" : ""}`}
                    disabled={isFetchingZonia}
                  >
                    {isFetchingZonia ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text className="text-white font-bold text-lg">
                        Check data
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
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
                setShowDetailsModal(false);
              }}
              color="#6b46c1"
            />
          </View>
        </View>
      </Modal>

      <Modal animationType="fade" transparent={true} visible={showZoniaModal}>
        <View className="flex-1 justify-center items-center bg-black/60">
          <View className="m-4 bg-white rounded-3xl p-8 items-center shadow-2xl shadow-gray-400 w-[95%] max-w-[400px] justify-center">
            <Text className="text-3xl font-extrabold text-indigo-800 mb-6 text-center">
              Zonia Status
            </Text>

            {resultZonia && zoniaRequestState === "completed" && (
              <View className="flex-row items-center justify-center mb-6">
                <CheckCircle size={36} color="#28a745" />
                <Text className="text-2xl text-green-700 font-bold ml-3">
                  Success!
                </Text>
              </View>
            )}

            {resultZonia && zoniaRequestState === "failed" && (
              <View className="flex-row items-center justify-center mb-6">
                <AlertCircle size={36} color="#dc3545" />
                <Text className="text-2xl text-red-700 font-bold ml-3">
                  Failed!
                </Text>
              </View>
            )}

            {!resultZonia && (
              <View className="flex-row items-center justify-center mb-6">
                <Clock size={36} color="#ffc107" />
                <Text className="text-2xl text-orange-600 font-bold ml-3">
                  Processing ...
                </Text>
              </View>
            )}

            <View className="w-full mb-8 border-t border-b border-gray-200 py-4">
              {zoniaStates.map((state, index) => (
                <View key={state} className="flex-row items-center mb-2">
                  <View
                    className={`w-4 h-4 rounded-full mr-3 ${getCircleStyle(index)}`}
                  />
                  <Text className={`text-base ${getLabelStyle(index)}`}>
                    {state.charAt(0).toUpperCase() + state.slice(1)}
                  </Text>
                </View>
              ))}
            </View>

            {resultZonia &&
              (zoniaRequestState === "failed" ||
                zoniaRequestState === "completed") && (
                <View className="w-full bg-gray-50 p-4 rounded-lg mb-6 border border-gray-200">
                  <Text className="font-bold text-gray-800 text-lg mb-2">
                    Result:
                  </Text>
                  <ScrollView className="max-h-[120px]">
                    <Text className="text-gray-600 text-sm break-words leading-5">
                      {resultZonia}
                    </Text>
                  </ScrollView>
                </View>
              )}

            {zoniaRequestState === "completed" &&
              resultZonia &&
              details &&
              walletAddress?.toLowerCase() ===
                details.userWallet.toLowerCase() &&
              canRequestPayout && (
                <TouchableOpacity
                  onPress={handleRequestPayout}
                  className={`mt-5 bg-green-500 self-center rounded-full w-[200px] h-[45px] items-center justify-center`}
                >
                  <Text className="text-white font-bold text-lg">
                    Request Payout
                  </Text>
                </TouchableOpacity>
              )}

            {(zoniaRequestState === "completed" ||
              zoniaRequestState === "failed") &&
              resultZonia && (
                <TouchableOpacity
                  onPress={() => {
                    clearZoniaRequestState();
                    setShowDetailsModal(true);
                    setShowZoniaModal(false);
                    setResultZonia(undefined);
                  }}
                  className="mt-4 bg-purple-600 px-6 py-3 rounded-full shadow-md shadow-purple-400"
                >
                  <Text className="text-white font-bold text-lg">Close</Text>
                </TouchableOpacity>
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
                <Text className="text-gray-600 mt-4">Caricamento mappa...</Text>
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
