import React, { useEffect, useState } from 'react';
import { ArrowUpDown, ArrowRight, AlertTriangle, Clock, X, Loader2 } from 'lucide-react';
import { ProcessingState, SwapOrder } from '../types';

interface SwapPair {
  from: string;
  to: string;
  rate: number;
}

interface SwapModuleProps {
  availableTokens: string[];
  swapPairs: SwapPair[];
  userBalances: Record<string, number>;
  swapOrders: SwapOrder[];
  hasDeposit: boolean;
  onSwap: (fromToken: string, toToken: string, amount: number) => void;
  onCancelSwap: (orderId: string) => void;
  isProcessing: ProcessingState;
}

export default function SwapModule({
  availableTokens,
  swapPairs,
  userBalances,
  swapOrders,
  hasDeposit,
  onSwap,
  onCancelSwap,
  isProcessing,
}: SwapModuleProps) {
  const [fromToken, setFromToken] = useState('USDM');
  const [toToken, setToToken] = useState('ST');
  const [amount, setAmount] = useState('');
  const [cancelOrderId, setCancelOrderId] = useState('');

  const swapIsProcessing = isProcessing.bool && isProcessing.action === 'swap';

  useEffect(() => {
    if (!swapIsProcessing && cancelOrderId) {
      setCancelOrderId('');
    }
  }, [swapIsProcessing, cancelOrderId]);
  
  const currentPair = swapPairs.find(pair => 
    pair.from === fromToken && pair.to === toToken
  );
  
  const estimatedOutput = currentPair && amount ? 
    (parseFloat(amount) * currentPair.rate).toFixed(6) : '0';

  const handleSwap = () => {
    if (amount && parseFloat(amount) > 0) {
      onSwap(fromToken, toToken, parseFloat(amount));
      setAmount('');
    }
  };

  const swapTokens = () => {
    const temp = fromToken;
    setFromToken(toToken);
    setToToken(temp);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2">
        <ArrowUpDown className="w-6 h-6 text-purple-400" />
        <h2 className="text-2xl font-bold text-white">Token Swap</h2>
      </div>

      {!hasDeposit ? (
        <div className="bg-gray-800 rounded-xl shadow-lg border border-gray-700 p-12 text-center">
          <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <ArrowUpDown className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Deposit Required</h3>
          <p className="text-gray-400 mb-6">You need to make a deposit first before you can swap tokens</p>
          <div className="inline-flex items-center space-x-2 text-sm text-gray-500">
            <AlertTriangle className="w-4 h-4" />
            <span>Go to Deposits tab to get started</span>
          </div>
        </div>
      ) : (
        <>
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <div className="space-y-4">
          {/* From Token */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">From</label>
            <div className="flex space-x-2">
              <select
                value={fromToken}
                onChange={(e) => setFromToken(e.target.value)}
                className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {availableTokens.map(token => (
                  <option key={token} value={token}>{token}</option>
                ))}
              </select>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="text-sm text-gray-400">
              Balance: {userBalances[fromToken]?.toFixed(2) || '0.00'} {fromToken}
            </div>
          </div>

          {/* Swap Button */}
          <div className="flex justify-center">
            <button
              onClick={swapTokens}
              className="p-2 bg-gray-700 hover:bg-gray-600 rounded-full transition-colors"
            >
              <ArrowUpDown className="w-4 h-4 text-gray-300" />
            </button>
          </div>

          {/* To Token */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">To</label>
            <div className="flex space-x-2">
              <select
                value={toToken}
                onChange={(e) => setToToken(e.target.value)}
                className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {availableTokens.map(token => (
                  <option key={token} value={token}>{token}</option>
                ))}
              </select>
              <div className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-gray-400">
                {estimatedOutput}
              </div>
            </div>
            <div className="text-sm text-gray-400">
              Balance: {userBalances[toToken]?.toFixed(2) || '0.00'} {toToken}
            </div>
          </div>
        </div>

        {/* Exchange Rate */}
        {currentPair && (
          <div className="mt-4 p-3 bg-gray-700 rounded-lg">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-300">Exchange Rate</span>
              <span className="text-white">
                1 {fromToken} = {currentPair.rate} {toToken}
              </span>
            </div>
          </div>
        )}

        {/* Swap Button */}
        <button
          onClick={handleSwap}
          disabled={!amount || parseFloat(amount) <= 0 || !currentPair || swapIsProcessing}
          className="w-full mt-6 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
        >
          {(swapIsProcessing && !cancelOrderId) ? 'Processing...' :
            <>
              <ArrowRight className="w-4 h-4" />
              <span>Swap Tokens</span>
            </>
          }
        </button>
          </div>

          {/* Pending Orders */}
          {swapOrders.filter(order => order.status === 'pending').length > 0 && (
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h3 className="text-lg font-semibold text-white mb-4">Pending Orders</h3>
              <div className="space-y-3">
                {swapOrders
                  .filter(order => order.status === 'pending')
                  .map((order) => (
                    <div key={order.id} className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <Clock className="w-4 h-4 text-yellow-400" />
                        <div>
                          <span className="text-white">
                            {order.fromAmount.toFixed(2)} {order.fromToken} → {order.expectedToAmount.toFixed(2)} {order.toToken}
                          </span>
                          <p className="text-xs text-gray-400">
                            Rate: 1 {order.fromToken} = {order.rate} {order.toToken}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-yellow-400 bg-yellow-900/20 px-2 py-1 rounded">
                          Pending
                        </span>
                        <button
                          onClick={() => {
                            setCancelOrderId(order.id);
                            onCancelSwap(order.id);
                          }}
                          className="p-1 text-gray-400 hover:text-red-400 hover:bg-gray-600 rounded transition-colors"
                          title="Cancel Order"
                        >
                          {(swapIsProcessing && cancelOrderId === order.id) ?
                            <Loader2 className="w-4 h-4 animate-spin" /> :
                            <X className="w-4 h-4" />
                          }
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Recent Swaps */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-4">Swap History</h3>
            <div className="space-y-3">
              {swapOrders
                .filter(order => order.status !== 'pending')
                .slice(0, 5)
                .map((order) => (
                  <div key={order.id} className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <ArrowRight className="w-4 h-4 text-purple-400" />
                      <span className="text-white">
                        {order.fromAmount.toFixed(2)} {order.fromToken} → {order.expectedToAmount.toFixed(2)} {order.toToken}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`text-xs px-2 py-1 rounded ${
                        order.status === 'executed' 
                          ? 'text-green-400 bg-green-900/20' 
                          : 'text-red-400 bg-red-900/20'
                      }`}>
                        {order.status === 'executed' ? 'Executed' : 'Cancelled'}
                      </span>
                      <span className="text-sm text-gray-400">
                        {order.timestamp.toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              {swapOrders.filter(order => order.status !== 'pending').length === 0 && (
                <div className="text-center py-4">
                  <p className="text-gray-400">No swap history yet</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}