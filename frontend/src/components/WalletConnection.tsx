import React, { useEffect, useState } from 'react';
import { Wallet, CheckCircle } from 'lucide-react';
import { useWalletCustom } from './WalletConnectionContext';

type DetectedWallet = {
  key: string;
  name: string;
  icon?: string;
}

interface WalletConnectionProps {
  onDisconnect: () => void;
}

const WalletConnection: React.FC<WalletConnectionProps> = ({
  onDisconnect,
}) => {
  const { address, connected, walletName, balance, connect, connecting } = useWalletCustom();
  const [availableWallets, setAvailableWallets] = useState<DetectedWallet[]>([]);
  const [showWalletModal, setShowWalletModal] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.cardano) {
      const cardano = window.cardano;
      const detected: DetectedWallet[] = Object.keys(cardano)
        .filter(key => cardano[key].enable)
        .map(key => ({
          key,
          name: cardano[key].name,
          icon: cardano[key].icon,
        }));
        setAvailableWallets(detected);
    }
  }, []);

  if (connected) {
    return (
      <div className="bg-gray-800 rounded-xl shadow-lg p-4 border border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-green-900/20 rounded-full flex items-center justify-center">
              <CheckCircle className="w-4 h-4 text-green-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm">{walletName}</h3>
              <p className="text-xs text-gray-400">
                {address.slice(0, 12)}...{address.slice(-6)}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-white">{(Number(balance[0]?.quantity ?? "") / 1000000).toFixed(2)} ADA</p>
            <button
              onClick={onDisconnect}
              className="text-xs text-red-400 hover:text-red-300 transition-colors"
            >
              Disconnect
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-xl shadow-lg p-8 border border-gray-700 text-center">
      <div className="w-16 h-16 bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
        <Wallet className="w-8 h-8 text-blue-400" />
      </div>
      <h2 className="text-xl font-bold text-white mb-2">Connect Your Wallet</h2>
      <p className="text-gray-400 mb-6">
        Connect your Cardano wallet to start using Statera DeFi platform
      </p>
      <button
        onClick={() => setShowWalletModal(true)}
        disabled={connecting}
        className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold px-8 py-3 rounded-lg transition-colors flex items-center space-x-2 mx-auto"
      >
        {connecting ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            <span>Connecting...</span>
          </>
        ) : (
          <>
            <Wallet className="w-5 h-5" />
            <span>Connect Wallet</span>
          </>
        )}
      </button>
      {showWalletModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl shadow-lg p-6 w-80">
            <h3 className="text-white font-bold mb-4">Select a wallet</h3>
            <div className="space-y-3">
              {availableWallets.map((wallet) => (
                <button
                  key={wallet.key}
                  onClick={async () => {
                    setShowWalletModal(false);
                    await connect(wallet.key, [], true);
                  }}
                  className="flex items-center space-x-3 w-full bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  {wallet.icon && (
                    <img src={wallet.icon} alt={wallet.name} className="w-6 h-6" />
                  )}
                  <span>{wallet.name}</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowWalletModal(false)}
              className="mt-4 text-gray-400 hover:text-gray-200 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default WalletConnection;
