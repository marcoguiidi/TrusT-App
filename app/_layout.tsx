import { Stack, SplashScreen } from "expo-router";
import { useEffect } from "react";
import { AuthProvider, useAuth } from "../context/AuthContext";
import WalletConnectionProvider from "../components/WalletConnectionProvider";

SplashScreen.preventAutoHideAsync();

function RootLayoutContent() {
  const { walletConnected, selectedAppRole, isCoreContractsReady } = useAuth();

  useEffect(() => {
    if (
      walletConnected !== undefined &&
      selectedAppRole !== undefined &&
      isCoreContractsReady !== undefined
    ) {
      SplashScreen.hideAsync();
    }
  }, [walletConnected, selectedAppRole, isCoreContractsReady]);

  if (
    walletConnected === undefined ||
    selectedAppRole === undefined ||
    isCoreContractsReady === undefined
  ) {
    return null;
  }

  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="dashboard" options={{ headerShown: false }} />
      <Stack.Screen name="browse" options={{ headerShown: false }} />
      <Stack.Screen name="create" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <WalletConnectionProvider>
      <AuthProvider>
        <RootLayoutContent />
      </AuthProvider>
    </WalletConnectionProvider>
  );
}
