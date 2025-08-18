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
  Coins,
  RefreshCcw,
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
  <View className="flex-row items-center justify-between py-3 border-b border-gray-200 last:border-b-0">
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
    if (expiredInsurances.length === 0) {
      Alert.alert(
        "No Policies",
        "There are no active or pending policies to check.",
      );
      return;
    }

    setUpdating(true);
    try {
      const addressesToUpdate = expiredInsurances
        .filter(
          (item) =>
            item.details.currentStatus !== 4 &&
            item.details.currentStatus !== 2,
        )
        .map((item) => item.address);

      if (addressesToUpdate.length === 0) {
        Alert.alert(
          "No Update",
          "All expired policies have already been updated.",
        );
        return;
      }

      await batchUpdateExpiredPolicies(addressesToUpdate);
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
    const isClaimed = status === 2;
    const isExpired = status === 4;
    const isToUpdate = !isClaimed && !isExpired;

    let containerStyle = "p-4 my-2 mx-4 bg-white rounded-2xl shadow-sm border";
    let statusTextStyle = "text-sm font-bold";
    let icon = <Clock size={16} color="#9ca3af" />;

    if (isClaimed) {
      containerStyle += " border-emerald-500";
      statusTextStyle += " text-emerald-500";
      icon = <Coins size={16} color="#10b981" />;
    } else if (isToUpdate) {
      containerStyle += " border-red-500";
      statusTextStyle += " text-red-500";
      icon = <AlertCircle size={16} color="#ef4444" />;
    } else if (isExpired) {
      containerStyle += " border-gray-400";
      statusTextStyle += " text-gray-400";
      icon = <Clock size={16} color="#9ca3af" />;
    }

    return (
      <TouchableOpacity
        className={containerStyle}
        onPress={() => openDetailsModal(item.address)}
        activeOpacity={0.85}
      >
        <View className="flex-row items-center mb-1">
          {icon}
          <Text className="text-xs font-semibold text-neutral-500 ml-2">
            Contract ID
          </Text>
        </View>
        <Text className="text-sm text-blue-500 font-medium ml-6">
          {`${item.address.slice(0, 6)}...${item.address.slice(-4)}`}
        </Text>
        <View className="flex-row justify-between items-center mt-2">
          <Text className="text-xs font-semibold text-neutral-500">Status</Text>
          <Text className={statusTextStyle}>{StatusMap[status]}</Text>
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
    <SafeAreaView className="bg-white h-full">
      <View className="p-4 bg-white">
        <View className="flex-row justify-between items-center mt-4">
          <TouchableOpacity onPress={() => router.replace("/dashboard")}>
            <Text className="text-base font-medium text-blue-500">← Home</Text>
          </TouchableOpacity>
          <Text className="text-xl font-bold text-blue-800">
            Expired Policies
          </Text>
          <View className="w-[50px]" />
        </View>
      </View>

      {selectedAppRole === "company" && (
        <TouchableOpacity
          onPress={handleUpdateExpired}
          activeOpacity={0.8}
          className={`mx-4 rounded-xl flex-row items-center justify-center h-12 mb-6 ${
            updating ? "bg-blue-300" : "bg-blue-600"
          }`}
          disabled={updating}
        >
          {updating ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <RefreshCcw size={16} color="#fff" className="mr-3" />
              <Text className="text-white font-semibold text-base ml-3">
                Update Expired Policies
              </Text>
            </>
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
          contentContainerStyle={{ paddingVertical: 16 }}
        />
      ) : (
        <View className="flex-1 items-center justify-center">
          <Text className="text-lg text-gray-500">
            No expired insurances found.
          </Text>
        </View>
      )}

      <Modal
        isVisible={isDetailModalVisible}
        onBackdropPress={() => setIsDetailModalVisible(false)}
        className="justify-center items-center m-0"
      >
        <View className="bg-white p-6 rounded-2xl w-full max-w-sm shadow-xl">
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
            <View className="space-y-1 bg-gray-50 rounded-lg p-3">
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
            className="mt-6 bg-blue-600 rounded-full h-10 items-center justify-center shadow"
            activeOpacity={0.85}
          >
            <Text className="text-white font-semibold">Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
