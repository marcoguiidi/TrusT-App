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
import { JSX, useEffect, useState } from "react";
import Modal from "react-native-modal";
import {
  Clipboard,
  Clock,
  User,
  CalendarDays,
  AlertCircle,
  TrendingUp,
} from "lucide-react-native";
import * as clipboard from "expo-clipboard";

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

const DetailRow = ({
                     icon,
                     label,
                     value,
                     isCopyable = false,
                     onCopy,
                   }: {
  icon: JSX.Element;
  label: string;
  value: string;
  isCopyable?: boolean;
  onCopy?: () => void;
}) => (
  <View className="flex-row items-center justify-between p-3 border-b border-gray-200 last:border-b-0">
    <View className="flex-row items-center">
      {icon}
      <Text className="text-sm font-semibold text-neutral-600 ml-3">
        {label}
      </Text>
    </View>
    {isCopyable ? (
      <TouchableOpacity onPress={onCopy} className="flex-row items-center">
        <Text className="text-sm text-blue-500 font-medium mr-2 underline">
          {`${value.slice(0, 6)}...${value.slice(-4)}`}
        </Text>
        <Clipboard size={16} color="#3b82f6" />
      </TouchableOpacity>
    ) : (
      <Text className="text-sm font-medium text-neutral-800">{value}</Text>
    )}
  </View>
);

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

  const copyToClipboard = async (text: string) => {
    await clipboard.setStringAsync(text);
    Alert.alert("Copied!", "Address copied to clipboard.");
  };

  const fetchExpiredInsurances = async () => {
    if (!walletAddress) return;

    setLoading(true);
    try {
      const activeAddresses = await getSmartInsurancesForWallet(
        walletAddress,
        "active",
      );
      const pendingAddresses = await getSmartInsurancesForWallet(
        walletAddress,
        "pending",
      );

      const allAddresses = [...activeAddresses, ...pendingAddresses];
      const expired: InsuranceItem[] = [];
      const notExpired: InsuranceItem[] = [];

      const currentTimestampInSeconds = Math.floor(Date.now() / 1000);

      for (const address of allAddresses) {
        const details = await getDetailForSmartInsurance(address);
        if (!details) continue;

        // @ts-ignore
        const item: InsuranceItem = { address, details };
        if (
          details.currentStatus === 4 ||
          details.currentStatus === 2 ||
          details.expirationTimestamp < currentTimestampInSeconds
        ) {
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

  const openDetailsModal = (address: string) => {
    const insurance = expiredInsurances.find(
      (item) => item.address === address,
    );
    if (insurance) {
      setSelectedInsurance(insurance);
      setIsDetailModalVisible(true);
    } else {
      Alert.alert("Error", "Insurance details not found.");
    }
  };

  const renderItem = ({ item }: { item: InsuranceItem }) => {
    const status = item.details.currentStatus;
    const isExpired = status === 4;
    const toUpdate = !isExpired

    let containerStyle = "p-4 my-2 mx-4 bg-white rounded-2xl shadow-sm border";
    let statusTextStyle = "text-sm font-bold";

    if (isExpired) {
      containerStyle += " border-green-500";
      statusTextStyle += " text-green-500";
    } else if (toUpdate) {
      containerStyle += " border-rose-500";
      statusTextStyle += " text-rose-500";
    } else {
      containerStyle += " border-gray-200";
      statusTextStyle += " text-neutral-800";
    }

    return (
      <TouchableOpacity
        className={containerStyle}
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
          <Text className={statusTextStyle}>
            {StatusMap[status]}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

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
        className="justify-center items-center m-0"
      >
        <View className="bg-white p-6 rounded-2xl w-full max-w-sm shadow-xl border border-gray-200">
          <View className="items-center mb-4">
            <View className="flex-row items-center space-x-2 mb-2">
              <AlertCircle size={28} color="#ef4444" />
              <Text className="text-2xl font-bold text-red-600">Expired!</Text>
            </View>
            <Text className="text-sm text-center text-gray-500">
              This policy has passed its expiration date.
            </Text>
          </View>
          {selectedInsurance && (
            <View className="space-y-1 border border-gray-200 rounded-lg overflow-hidden">
              <View className="flex-row items-center justify-between p-3 bg-red-50">
                <View className="flex-row items-center">
                  <Clock size={18} color="#dc2626" />
                  <Text className="text-sm font-semibold text-red-600 ml-3">
                    Status
                  </Text>
                </View>
                <Text className="text-sm font-bold text-red-600">
                  {StatusMap[selectedInsurance.details.currentStatus]}
                </Text>
              </View>
              <DetailRow
                icon={<Clipboard size={18} color="#4b5563" />}
                label="Contract ID"
                value={selectedInsurance.address}
                isCopyable
                onCopy={() => copyToClipboard(selectedInsurance.address)}
              />
              <DetailRow
                icon={<User size={18} color="#4b5563" />}
                label="User Wallet"
                value={selectedInsurance.details.userWallet}
                isCopyable
                onCopy={() =>
                  copyToClipboard(selectedInsurance.details.userWallet)
                }
              />
              <DetailRow
                icon={<CalendarDays size={18} color="#4b5563" />}
                label="Expiration"
                value={new Date(
                  selectedInsurance.details.expirationTimestamp * 1000,
                ).toLocaleDateString()}
              />
              <DetailRow
                icon={<TrendingUp size={18} color="#4b5563" />}
                label="Payout Amount"
                value={`${selectedInsurance.details.payoutAmount}`}
              />
            </View>
          )}
          <TouchableOpacity
            onPress={() => setIsDetailModalVisible(false)}
            className="mt-6 bg-blue-500 rounded-full h-10 items-center justify-center shadow"
            activeOpacity={0.85}
          >
            <Text className="text-white font-semibold">Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}