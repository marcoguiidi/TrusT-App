import React, { ReactNode } from "react";
import { WalletConnectModal } from "@walletconnect/modal-react-native";
import { projectId, providerMetadata } from "../constants/walletConnectConfig";

interface WalletConnectionProviderProps {
  children: ReactNode;
}

const WalletConnectionProvider: React.FC<WalletConnectionProviderProps> = ({
  children,
}) => {
  return (
    <>
      {children}
      <WalletConnectModal
        projectId={projectId}
        providerMetadata={providerMetadata}
      />
    </>
  );
};

export default WalletConnectionProvider;
