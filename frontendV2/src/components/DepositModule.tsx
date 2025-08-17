import React, { useState } from 'react';
import { PlusCircle, MinusCircle, X, AlertTriangle } from 'lucide-react';

interface DepositModuleProps {
  currentDeposit: number;
  availableBalance: number;
  onNewDeposit: (amount: number) => void;
  onDeposit: (amount: number) => void;
  onWithdraw: (amount: number) => void;
  onCloseAccount: () => void;
  isProcessing: boolean;
}

const DepositModule: React.FC<DepositModuleProps> = ({
  currentDeposit,
  availableBalance,
  onNewDeposit,
  onDeposit,
  onWithdraw,
  onCloseAccount,
  isProcessing,
}) => {
  const [amount, setAmount] = useState('');
  const [action, setAction] = useState< 'newDeposit' | 'deposit' | 'withdraw' | null>(null);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !action) return;

    if (action === 'newDeposit') {
      onNewDeposit(parseFloat(amount));
    }
    else if (action === 'deposit') {
      onDeposit(parseFloat(amount));
    } else {
      onWithdraw(parseFloat(amount));
    }
    setAmount('');
    setAction(null);

    // setIsProcessing(true);
    // setTimeout(() => {
    //   if (action === 'newDeposit') {
    //     onNewDeposit(parseFloat(amount));
    //   }
    //   else if (action === 'deposit') {
    //     onDeposit(parseFloat(amount));
    //   } else {
    //     onWithdraw(parseFloat(amount));
    //   }
    //   setAmount('');
    //   setAction(null);
    //   // setIsProcessing(false);
    // }, 2000);
  };

  const handleCloseAccount = () => {
    setShowCloseConfirm(true);
  };

  const confirmCloseAccount = () => {
    onCloseAccount();
    setShowCloseConfirm(false);
  };

  return (
    <div className="bg-gray-800 rounded-xl shadow-lg border border-gray-700">
      <div className="p-6 border-b border-gray-700">
        <h2 className="text-xl font-semibold text-white">Deposit Management</h2>
        <p className="text-gray-400 mt-1">Manage your ADA deposits</p>
      </div>

      <div className="p-6">
        {/* Current Position */}
        <div className="bg-gray-900 rounded-lg p-4 mb-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-400">Current Deposit</p>
              <p className="text-2xl font-bold text-white">{currentDeposit.toFixed(2)} ADA</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Available Balance</p>
              <p className="text-2xl font-bold text-white">{availableBalance.toFixed(2)} ADA</p>
            </div>
          </div>
        </div>

        {/* Action Selection */}
        {(!action && !isProcessing) && currentDeposit > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <button
              onClick={() => setAction('deposit')}
              className="flex items-center justify-center space-x-2 bg-green-900/20 hover:bg-green-900/30 text-green-400 p-4 rounded-lg border border-green-700 transition-colors"
            >
              <PlusCircle className="w-5 h-5" />
              <span className="font-semibold">Increase Deposit</span>
            </button>
            <button
              onClick={() => setAction('withdraw')}
              className="flex items-center justify-center space-x-2 bg-red-900/20 hover:bg-red-900/30 text-red-400 p-4 rounded-lg border border-red-700 transition-colors"
              disabled={currentDeposit === 0}
            >
              <MinusCircle className="w-5 h-5" />
              <span className="font-semibold">Partial Withdraw</span>
            </button>
          </div>
        )}

        {/* Zero Deposit State */}
        {(!action && !isProcessing) && currentDeposit === 0 && (
          <div className="text-center mb-6">
            <div className="bg-blue-900/10 border border-blue-700 rounded-lg p-6">
              <div className="w-16 h-16 bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <PlusCircle className="w-8 h-8 text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">No Active Deposits</h3>
              <p className="text-gray-400 mb-6">Start by making your first deposit to begin using Statera</p>
              <button
                onClick={() => setAction('newDeposit')}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors flex items-center space-x-2 mx-auto"
              >
                <PlusCircle className="w-5 h-5" />
                <span>Make First Deposit</span>
              </button>
            </div>
          </div>
        )}

        {/* Close Account Section */}
        {(!action && !isProcessing) && currentDeposit > 0 && (
          <div className="mt-8 pt-6 border-t border-gray-700">
            <div className="bg-red-900/10 border border-red-700 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5" />
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-red-400">Danger Zone</h4>
                  <p className="text-sm text-gray-400 mt-1">
                    Closing your account will withdraw all deposited funds and cannot be undone.
                  </p>
                  <button
                    onClick={handleCloseAccount}
                    className="mt-3 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    Close Account
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Amount Input Form */}
        {((action || isProcessing) && !showCloseConfirm) && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-white capitalize">
                {action} ADA
              </h3>
              <button
                type="button"
                onClick={() => {
                  setAction(null);
                  setAmount('');
                }}
                className="text-gray-400 hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label htmlFor="amount" className="block text-sm font-medium text-gray-300 mb-2">
                Amount (ADA)
              </label>
              <div className="relative">
                <input
                  type="number"
                  id="amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  max={action === 'withdraw' ? currentDeposit : availableBalance}
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white"
                  required
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                  <span className="text-gray-400 text-sm">ADA</span>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Max: {action === 'withdraw' ? currentDeposit.toFixed(2) : availableBalance.toFixed(2)} ADA
              </p>
            </div>

            <div className="flex space-x-3">
              <button
                type="submit"
                disabled={!amount || isProcessing || parseFloat(amount) <= 0}
                className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors text-white ${
                  action === 'withdraw'
                    ? 'bg-red-600 hover:bg-red-700 disabled:bg-red-400'
                    : 'bg-green-600 hover:bg-green-700 disabled:bg-green-400'
                }`}
              >
                {isProcessing ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Processing...</span>
                  </div>
                ) : (
                  `${action === 'withdraw' ? 'Withdraw' : 'Deposit'} ${amount || '0'} ADA`
                )}
              </button>
            </div>
          </form>
        )}

        {/* Close Account Confirmation Modal */}
        {showCloseConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4 border border-gray-700">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-red-900/20 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">Close Account</h3>
              </div>
              <p className="text-gray-400 mb-6">
                Are you sure you want to close your account? This will withdraw all {currentDeposit.toFixed(2)} ADA 
                and permanently close your position. This action cannot be undone.
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowCloseConfirm(false)}
                  className="flex-1 py-2 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmCloseAccount}
                  className="flex-1 py-2 px-4 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                >
                  Close Account
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DepositModule;
