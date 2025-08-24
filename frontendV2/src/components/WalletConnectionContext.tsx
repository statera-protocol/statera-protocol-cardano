import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useWallet } from '@meshsdk/react';
import { Asset, deserializeAddress, IWallet, MaestroProvider, MeshTxBuilder, NativeScript, resolveNativeScriptHash, serializeNativeScript, UTxO } from '@meshsdk/core';

// Shape of wallet context
interface WalletContextType {
  walletReady: boolean;
  connecting: boolean;
  connected: boolean;
  wallet: IWallet;
  address: string;
  walletName: string,
  walletVK: string;
  walletSK: string;
  balance: Asset[];
  txBuilder: MeshTxBuilder | null;
  blockchainProvider: MaestroProvider | null;
  walletUtxos: UTxO[];
  walletCollateral: UTxO | null;
  refreshWalletState: () => void;
  connect: (walletName: string, extensions?: number[], persist?: boolean) => Promise<void>;
  disconnect: () => void;
}

// Create the context
const WalletContext = createContext<WalletContextType | undefined>(undefined);

// Provider component
export function WalletConnectionProvider({ children }: { children: ReactNode }) {
  const { wallet, connected, name, disconnect, connect, connecting } = useWallet();
  const [address, setAddress] = useState<string>("");
  const [walletVK, setWalletVK] = useState<string>("");
  const [walletSK, setWalletSK] = useState<string>("");
  const [balance, setBalance] = useState<Asset[]>([]);
  const [walletUtxos, setWalletUtxos] = useState<UTxO[]>([]);
  const [walletCollateral, setWalletCollateral] = useState<UTxO | null>(null);
  const [txBuilder, setTxBuilder] = useState<MeshTxBuilder | null>(null);
  const [blockchainProvider, setBlockchainProvider] = useState<MaestroProvider | null>(null);
  const [walletReady, setWalletReady] = useState<boolean>(false);
  const [refreshWallet, setRefreshWallet] = useState<boolean>(false);

  useEffect(() => {
    const handleWallet = async () => {
      setWalletReady(false);

      const maestroKey = process.env.NEXT_PUBLIC_MAESTRO_KEY;
      if (!maestroKey) {
        throw new Error("MAESTRO_KEY does not exist");
      }

      const bp = new MaestroProvider({
        network: 'Preprod',
        apiKey: maestroKey,
      });
      const tb = new MeshTxBuilder({
        fetcher: bp,
        submitter: bp,
        evaluator: bp,
        verbose: false,
      });
      tb.setNetwork('preprod');

      setTxBuilder(tb);
      setBlockchainProvider(bp);

      if (connected && wallet) {
        try {
          const walletAddress = await wallet.getChangeAddress();
          const balance = await wallet.getBalance();
          const { pubKeyHash: walletVK, stakeCredentialHash: walletSK } = deserializeAddress(walletAddress);

          const fetchedWalletUtxos = await wallet.getUtxos();
          const fetchedWalletCollateral: UTxO[] = await wallet.getCollateral();

          setAddress(walletAddress);
          setBalance(balance);
          setWalletVK(walletVK);
          setWalletSK(walletSK);
          setWalletUtxos(fetchedWalletUtxos);
          setWalletCollateral(fetchedWalletCollateral[0] || null);

          setWalletReady(true);
        } catch (err) {
          console.error("Error setting up wallet state:", err);
          setWalletReady(false);
          setAddress("");
          setBalance([]);
          setWalletVK("");
          setWalletSK("");
          setWalletUtxos([]);
          setWalletCollateral(null);
        }
      } else {
        setAddress("");
        setBalance([]);
        setWalletVK("");
        setWalletSK("");
        setWalletUtxos([]);
        setWalletCollateral(null);
        setWalletReady(false);
      }
    };

    handleWallet();
  }, [connected, wallet, refreshWallet]);

  // Refresh wallet state trigger
  const refreshWalletState = () => {
    setRefreshWallet(prev => !prev);
  };

  return (
    <WalletContext.Provider
      value={{
        walletReady,
        connecting,
        connected,
        wallet,
        address,
        walletName: name ?? "",
        walletVK,
        walletSK,
        balance,
        txBuilder,
        blockchainProvider,
        walletUtxos,
        walletCollateral,
        refreshWalletState,
        connect,
        disconnect,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

// Custom hook
export function useWalletCustom() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWalletCustom must be used within WalletConnectionProvider');
  }
  return context;
}
