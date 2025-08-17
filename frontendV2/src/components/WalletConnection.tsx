import React, { useEffect, useState } from 'react';
import { Wallet, CheckCircle, AlertCircle } from 'lucide-react';
import { WalletInfo } from '../types';
import { CardanoWallet, useWallet } from '@meshsdk/react';
import { Asset, IWallet } from '@meshsdk/core';
import { useWalletCustom } from './WalletConnectionContext';

interface WalletConnectionProps {
  // wallet: IWallet;
  // onConnect: (wallet: WalletInfo) => void;
  onDisconnect: () => void;
}

const WalletConnection: React.FC<WalletConnectionProps> = ({
  // wallet,
  // onConnect,
  onDisconnect,
}) => {
  const { address, connected, walletName, balance, connect, connecting } = useWalletCustom();

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
    // <div className="bg-gray-800 rounded-xl shadow-lg p-8 border border-gray-700 text-center">
    //   <div className="w-16 h-16 bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
    //     <Wallet className="w-8 h-8 text-blue-400" />
    //   </div>
    //   <h2 className="text-xl font-bold text-white mb-2">Connect Your Wallet</h2>
    //   <p className="text-gray-400 mb-6">
    //     Connect your Cardano wallet to start using Statera DeFi platform
    //   </p>
    //   <div className='bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold px-8 py-3 rounded-lg transition-colors flex items-center justify-center space-x-2 mx-auto'>
    //     <Wallet className="w-5 h-5" />
    //     <CardanoWallet isDark />
    //   </div>
    // </div>

    <div className="bg-gray-800 rounded-xl shadow-lg p-8 border border-gray-700 text-center">
      <div className="w-16 h-16 bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
        <Wallet className="w-8 h-8 text-blue-400" />
      </div>
      <h2 className="text-xl font-bold text-white mb-2">Connect Your Wallet</h2>
      <p className="text-gray-400 mb-6">
        Connect your Cardano wallet to start using Statera DeFi platform
      </p>
      <button
        onClick={async () => await connect("eternl", [], true)}
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
    </div>
  );
};

export default WalletConnection;
