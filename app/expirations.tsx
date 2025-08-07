import {
  Text,
  View,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../context/AuthContext";
import { useEffect, useState } from "react";
import Modal from "react-native-modal";

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

const StatusMap: Record<number, string> = {
  0: "Pending",
  1: "Active",
  2: "Claimed",
  3: "Cancelled",
  4: "Expired",
};

interface InsuranceItem {
  address: string;
  details: SmartInsuranceDetails;
}

export default function ExpirationsScreen() {
  const router = useRouter();
  const {
    walletAddress,
    getSmartInsurancesForWallet,
    getDetailForSmartInsurance,
    batchUpdateExpiredPolicies,
    selectedAppRole,
    provider,
  } = useAuth();

  const [expiredInsurances, setExpiredInsurances] = useState<InsuranceItem[]>(
    [],
  );
  const [activeInsurances, setActiveInsurances] = useState<InsuranceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
  const [selectedInsurance, setSelectedInsurance] =
    useState<InsuranceItem | null>(null);

  const fetchExpiredInsurances = async () => {
    if (!walletAddress) return;

    setLoading(true);
    try {
      const activeAddresses = await getSmartInsurancesForWallet(
        walletAddress,
        "active",
      );
      const closedAddresses = await getSmartInsurancesForWallet(
        walletAddress,
        "closed",
      );

      const allAddresses = [...activeAddresses, ...closedAddresses];
      const expired: InsuranceItem[] = [];
      const notExpired: InsuranceItem[] = [];

      for (const address of allAddresses) {
        const details = await getDetailForSmartInsurance(address);
        if (!details) continue;

        // @ts-ignore
        const item: InsuranceItem = { address, details };
        if (details.currentStatus === 4) {
          expired.push(item);
        } else {
          notExpired.push(item);
        }
      }

      setExpiredInsurances(expired);
      setActiveInsurances(notExpired);
    } catch (e) {
      console.error("Error fetching insurances:", e);
      Alert.alert("Error", "Failed to fetch insurance data.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateExpired = async () => {
    if (activeInsurances.length === 0) {
      Alert.alert(
        "No Policies",
        "There are no active or pending policies to check.",
      );
      return;
    }

    setUpdating(true);
    try {
      const addresses = activeInsurances.map((item) => item.address);
      await batchUpdateExpiredPolicies(addresses);
      Alert.alert("Success", "Expired policies have been updated.");
      await fetchExpiredInsurances();
    } catch (e) {
      console.error("Error updating policies:", e);
      Alert.alert("Error", "Failed to update policies.");
    } finally {
      setUpdating(false);
    }
  };

  const openDetailsModal = async (address: string) => {
    const details = await getDetailForSmartInsurance(address);
    if (details) {
      // @ts-ignore
      setSelectedInsurance({ address, details });
      setIsDetailModalVisible(true);
    } else {
      Alert.alert("Error", "Failed to fetch details for this insurance.");
    }
  };

  const renderItem = ({ item }: { item: InsuranceItem }) => (
    <TouchableOpacity
      className="p-4 my-2 mx-4 bg-white rounded-2xl shadow-sm border border-gray-200"
      onPress={() => openDetailsModal(item.address)}
      activeOpacity={0.85}
    >
      <View className="flex-row justify-between items-center mb-1">
        <Text className="text-xs font-semibold text-neutral-500">
          Contract ID
        </Text>
        <Text className="text-sm text-blue-500 font-medium">
          {`${item.address.slice(0, 6)}...${item.address.slice(-4)}`}
        </Text>
      </View>
      <View className="flex-row justify-between items-center mt-1">
        <Text className="text-xs font-semibold text-neutral-500">Status</Text>
        <Text className="text-sm font-bold text-rose-500">
          {StatusMap[item.details.currentStatus]}
        </Text>
      </View>
    </TouchableOpacity>
  );

  useEffect(() => {
    const fetchData = async () => {
      if (walletAddress) {
        await fetchExpiredInsurances();
      }
    };

    fetchData();
  }, [walletAddress, provider]);

  return (
    <SafeAreaView className="bg-white h-full items-center justify-start pt-8">
      <View className="w-full flex-row justify-between items-center px-4 mb-8">
        <Text
          onPress={() => router.replace("/dashboard")}
          className="text-base font-medium text-blue-500"
        >
          ← Home
        </Text>
        <Text className="text-xl font-bold text-blue-800">
          Expired Policies
        </Text>
        <View className="w-[50px]" />
      </View>

      {selectedAppRole === "company" && (
        <TouchableOpacity
          onPress={handleUpdateExpired}
          activeOpacity={0.8}
          className={`rounded-xl w-11/12 h-12 items-center justify-center mb-6 ${
            updating ? "bg-red-300" : "bg-red-500"
          }`}
          disabled={updating}
        >
          {updating ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text className="text-white font-semibold text-base">
              Update Expired Policies
            </Text>
          )}
        </TouchableOpacity>
      )}

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#0000ff" />
        </View>
      ) : expiredInsurances.length > 0 ? (
        <FlatList
          data={expiredInsurances}
          renderItem={renderItem}
          keyExtractor={(item) => item.address}
          className="w-full"
        />
      ) : (
        <Text className="text-lg text-gray-500 mt-10">
          No expired insurances found.
        </Text>
      )}

      <Modal
        isVisible={isDetailModalVisible}
        onBackdropPress={() => setIsDetailModalVisible(false)}
        className="justify-center items-center"
      >
        <View className="bg-white p-6 rounded-2xl w-full max-w-sm shadow-lg border border-gray-200">
          <Text className="text-xl font-bold text-center text-blue-800 mb-4">
            Policy Details
          </Text>
          {selectedInsurance && (
            <View className="space-y-3">
              <Text className="text-sm text-neutral-700">
                <Text className="font-semibold">Contract ID:</Text>{" "}
                {`${selectedInsurance.address.slice(0, 6)}...${selectedInsurance.address.slice(-4)}`}
              </Text>
              <Text className="text-sm text-neutral-700">
                <Text className="font-semibold">Status:</Text>{" "}
                <Text className="text-rose-500 font-medium">
                  {StatusMap[selectedInsurance.details.currentStatus]}
                </Text>
              </Text>
              <Text className="text-sm text-neutral-700">
                <Text className="font-semibold">User Wallet:</Text>{" "}
                {`${selectedInsurance.details.userWallet.slice(0, 6)}...${selectedInsurance.details.userWallet.slice(-4)}`}
              </Text>
              <Text className="text-sm text-neutral-700">
                <Text className="font-semibold">Expiration:</Text>{" "}
                {new Date(
                  selectedInsurance.details.expirationTimestamp * 1000,
                ).toLocaleDateString()}
              </Text>
            </View>
          )}
          <TouchableOpacity
            onPress={() => setIsDetailModalVisible(false)}
            className="mt-6 bg-blue-500 rounded-full h-10 items-center justify-center"
            activeOpacity={0.85}
          >
            <Text className="text-white font-semibold">Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
