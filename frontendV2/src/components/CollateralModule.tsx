import React, { useState } from 'react';
import { Shield, Coins, AlertTriangle, Plus, Minus, Edit3, Trash2 } from 'lucide-react';
import { CollateralToken, LoanPosition, ProcessingState } from '../types';

interface CollateralModuleProps {
  collateralTokens: CollateralToken[];
  loanPositions: LoanPosition[];
  hasDeposit: boolean;
  onCreateLoan: (token: string, collateralAmount: number, mintAmount: number) => void;
  onModifyLoan: (loanId: string, action: 'addCollateral' | 'removeCollateral' | 'repay' | 'fullRepay', amount: number) => void;
  onDeleteLoan: (loanId: string) => void;
  isProcessing: ProcessingState;
}

const CollateralModule: React.FC<CollateralModuleProps> = ({
  collateralTokens,
  loanPositions,
  hasDeposit,
  onCreateLoan,
  onModifyLoan,
  onDeleteLoan,
  isProcessing
}) => {
  const [showCreateLoan, setShowCreateLoan] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<string | null>(null);
  const [action, setAction] = useState<'addCollateral' | 'removeCollateral' | 'repay' | 'fullRepay' | null>(null);
  const [amount, setAmount] = useState('');

  // Create loan form state
  const [newLoan, setNewLoan] = useState({
    token: '',
    collateralAmount: '',
    mintAmount: '',
  });

  const loanIsProcessing = isProcessing.bool && isProcessing.action == 'loan';

  const handleCreateLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLoan.token || !newLoan.collateralAmount || !newLoan.mintAmount) return;

    onCreateLoan(newLoan.token, parseFloat(newLoan.collateralAmount), parseFloat(newLoan.mintAmount));

    setNewLoan({ token: '', collateralAmount: '', mintAmount: '' });
    setShowCreateLoan(false);
  };

  // Validation function for create loan button
  const isCreateLoanValid = () => {
    if (!newLoan.token || !newLoan.collateralAmount || !newLoan.mintAmount) return false;
    
    const selectedToken = collateralTokens.find(t => t.symbol === newLoan.token);
    if (!selectedToken) return false;
    
    const collateralAmount = parseFloat(newLoan.collateralAmount);
    const mintAmount = parseFloat(newLoan.mintAmount);
    
    if (collateralAmount <= 0 || mintAmount <= 0) return false;
    
    const collateralValueUSD = collateralAmount * selectedToken.price;
    const maxMintableAmount = (collateralValueUSD * selectedToken.maxLTV) / 100;
    const minMintableAmount = Math.max(10, maxMintableAmount * 0.1);
    
    return mintAmount >= minMintableAmount && mintAmount <= maxMintableAmount;
  };

  const handleModifyLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoan || !action) return;

    onModifyLoan(selectedLoan, action, parseFloat(amount));
    setAmount('');
    setAction(null);
    setSelectedLoan(null);
  };

  const getHealthFactorColor = (factor: number) => {
    if (factor >= 2) return 'text-green-400';
    if (factor >= 1.5) return 'text-yellow-400';
    return 'text-red-400';
  };

  const selectedLoanData = loanPositions.find(loan => loan.id === selectedLoan);
  const selectedTokenInfo = selectedLoanData ? collateralTokens.find(t => t.symbol === selectedLoanData.collateralToken) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Loan Positions</h2>
          <p className="text-gray-400 mt-1">Manage your collateral-backed loans</p>
        </div>
        {hasDeposit ? (
          <button
            onClick={() => setShowCreateLoan(true)}
            disabled={loanIsProcessing}
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Create Loan</span>
          </button>
        ) : (
          <div className="flex items-center space-x-2 bg-gray-700 text-gray-400 px-4 py-2 rounded-lg">
            <Shield className="w-4 h-4" />
            <span>Deposit Required</span>
          </div>
        )}
      </div>

      {/* Loan Positions */}
      {!hasDeposit ? (
        <div className="bg-gray-800 rounded-xl shadow-lg border border-gray-700 p-12 text-center">
          <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Deposit Required</h3>
          <p className="text-gray-400 mb-6">You need to make a deposit first before you can create loan positions</p>
          <div className="inline-flex items-center space-x-2 text-sm text-gray-500">
            <AlertTriangle className="w-4 h-4" />
            <span>Go to Deposits tab to get started</span>
          </div>
        </div>
      ) : loanPositions.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {loanPositions.map((loan) => {
            const tokenInfo = collateralTokens.find(t => t.symbol === loan.collateralToken);
            if (!tokenInfo) return null;

            return (
              <div key={loan.id} className="bg-gray-800 rounded-xl shadow-lg border border-gray-700 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-teal-900/20 rounded-full flex items-center justify-center">
                      <Shield className="w-5 h-5 text-teal-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">{tokenInfo.name} Loan</h3>
                      <p className="text-sm text-gray-400">Created {loan.createdAt.toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setSelectedLoan(loan.id)}
                      className="p-2 text-gray-400 hover:text-blue-400 hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-gray-400">Collateral</p>
                    <p className="text-lg font-bold text-white">{loan.collateralAmount.toFixed(2)} {loan.collateralToken}</p>
                    <p className="text-xs text-gray-500">${(loan.collateralAmount * tokenInfo.price).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Minted ST</p>
                    <p className="text-lg font-bold text-white">{loan.mintedST.toFixed(2)} ST</p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">Health Factor</p>
                    <p className={`text-lg font-bold ${getHealthFactorColor(loan.healthFactor)}`}>
                      {loan.healthFactor.toFixed(2)}
                    </p>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                    loan.healthFactor >= 2 ? 'text-green-400 bg-green-900/20' :
                    loan.healthFactor >= 1.5 ? 'text-yellow-400 bg-yellow-900/20' :
                    'text-red-400 bg-red-900/20'
                  }`}>
                    {loan.healthFactor >= 2 ? 'Safe' : loan.healthFactor >= 1.5 ? 'Moderate' : 'At Risk'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-gray-800 rounded-xl shadow-lg border border-gray-700 p-12 text-center">
          <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">No Loan Positions</h3>
          <p className="text-gray-400 mb-6">Create your first loan position to start minting ST tokens</p>
          <button
            onClick={() => setShowCreateLoan(true)}
            disabled={loanIsProcessing}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
          >
            {loanIsProcessing ? 'Processing...' : 'Create Loan'}
          </button>
        </div>
      )}

      {/* Create Loan Modal */}
      {showCreateLoan && hasDeposit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4 border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-4">Create New Loan</h3>
            <form onSubmit={handleCreateLoan} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Collateral Token</label>
                <select
                  value={newLoan.token}
                  onChange={(e) => setNewLoan({ ...newLoan, token: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white"
                  required
                >
                  <option value="">Select token</option>
                  {collateralTokens.map((token) => (
                    <option key={token.symbol} value={token.symbol}>
                      {token.name} ({token.symbol}) - ${token.price.toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">ST to Mint</label>
                <input
                  type="number"
                  value={newLoan.mintAmount}
                  onChange={(e) => setNewLoan({ ...newLoan, mintAmount: e.target.value })}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Collateral Amount</label>
                {newLoan.token && newLoan.mintAmount && (
                  <div className="mb-2 text-xs text-gray-400">
                    {(() => {
                      const selectedToken = collateralTokens.find(t => t.symbol === newLoan.token);
                      if (selectedToken && parseFloat(newLoan.mintAmount) > 0) {
                        const collateralValue = parseFloat(newLoan.mintAmount) / selectedToken.price;
                        const minCollateral = (collateralValue * 100) / selectedToken.maxLTV;
                        const maxCollateral = minCollateral * 100;
                        return `Min: ${minCollateral.toFixed(2)} ${newLoan.token} | Max: ${maxCollateral.toFixed(2)} ${newLoan.token} (${selectedToken.maxLTV}% LTV)`;
                      }
                      return '';
                    })()}
                  </div>
                )}
                <input
                  type="number"
                  value={newLoan.collateralAmount}
                  onChange={(e) => setNewLoan({ ...newLoan, collateralAmount: e.target.value })}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white"
                  required
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateLoan(false);
                    setNewLoan({ token: '', collateralAmount: '', mintAmount: '' });
                  }}
                  className="flex-1 py-2 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loanIsProcessing || !isCreateLoanValid()}
                  className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                >
                  {loanIsProcessing ? 'Creating...' : 'Create Loan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modify Loan Modal */}
      {selectedLoan && selectedLoanData && selectedTokenInfo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4 border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-4">
              Modify {selectedTokenInfo.name} Loan
            </h3>

            {!action ? (
              <div className="space-y-3">
                <button
                  onClick={() => setAction('addCollateral')}
                  className="w-full flex items-center space-x-3 p-3 bg-green-900/20 hover:bg-green-900/30 text-green-400 rounded-lg border border-green-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Collateral</span>
                </button>
                <button
                  onClick={() => setAction('removeCollateral')}
                  className="w-full flex items-center space-x-3 p-3 bg-red-900/20 hover:bg-red-900/30 text-red-400 rounded-lg border border-red-700 transition-colors"
                >
                  <Minus className="w-4 h-4" />
                  <span>Remove Collateral</span>
                </button>
                <button
                  onClick={() => setAction('repay')}
                  className="w-full flex items-center space-x-3 p-3 bg-blue-900/20 hover:bg-blue-900/30 text-blue-400 rounded-lg border border-blue-700 transition-colors"
                >
                  <Coins className="w-4 h-4" />
                  <span>Partial Repay</span>
                </button>
                <button
                  onClick={() => setAction('fullRepay')}
                  className="w-full flex items-center space-x-3 p-3 bg-purple-900/20 hover:bg-purple-900/30 text-purple-400 rounded-lg border border-purple-700 transition-colors"
                >
                  <Shield className="w-4 h-4" />
                  <span>Full Repayment</span>
                </button>
                <button
                  onClick={() => setSelectedLoan(null)}
                  className="w-full py-2 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <form onSubmit={handleModifyLoan} className="space-y-4">
                <div className="bg-gray-900 rounded-lg p-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-400">Collateral</p>
                      <p className="text-white font-medium">
                        {selectedLoanData.collateralAmount.toFixed(2)} {selectedLoanData.collateralToken}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400">Minted ST</p>
                      <p className="text-white font-medium">{selectedLoanData.mintedST.toFixed(2)} ST</p>
                    </div>
                  </div>
                </div>

                {action !== 'fullRepay' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Amount {action === 'repay' ? '(ST)' : `(${selectedLoanData.collateralToken})`}
                    </label>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white"
                      required
                    />
                  </div>
                )}

                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setAction(null);
                      setAmount('');
                    }}
                    className="flex-1 py-2 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={loanIsProcessing || (action !== 'fullRepay' && !amount)}
                    className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors"
                  >
                    {loanIsProcessing ? 'Processing...' : 'Confirm'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CollateralModule;