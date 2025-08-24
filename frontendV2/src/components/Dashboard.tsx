import React from 'react';
import { TrendingUp, Shield, Coins, ArrowUpDown, AlertTriangle, Activity } from 'lucide-react';
import { UserPosition, Transaction, ProtocolStats } from '../types';

interface DashboardProps {
  position: UserPosition;
  transactions: Transaction[];
  protocolStats: ProtocolStats;
}

const Dashboard: React.FC<DashboardProps> = ({ position, transactions, protocolStats }) => {
  const getHealthFactorColor = (factor: number) => {
    if (factor >= 2) return 'text-green-400 bg-green-900/20';
    if (factor >= 1.5) return 'text-yellow-400 bg-yellow-900/20';
    return 'text-red-400 bg-red-900/20';
  };

  return (
    <div className="space-y-6">
      {/* Protocol Overview */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-6">Protocol Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <div className="bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Total Value Locked</p>
                <p className="text-2xl font-bold text-white">${protocolStats.totalValueLocked.toLocaleString()}</p>
              </div>
              <div className="w-10 h-10 bg-blue-900/20 rounded-full flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-blue-400" />
              </div>
            </div>
          </div>

          <div className="bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Total ST Minted</p>
                <p className="text-2xl font-bold text-white">{protocolStats.totalSTMinted.toLocaleString()}</p>
              </div>
              <div className="w-10 h-10 bg-purple-900/20 rounded-full flex items-center justify-center">
                <Coins className="w-5 h-5 text-purple-400" />
              </div>
            </div>
          </div>

          <div className="bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Collateral Ratio</p>
                <p className="text-2xl font-bold text-white">{protocolStats.collateralRatio.toFixed(1)}%</p>
              </div>
              <div className="w-10 h-10 bg-teal-900/20 rounded-full flex items-center justify-center">
                <Shield className="w-5 h-5 text-teal-400" />
              </div>
            </div>
          </div>

          <div className="bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Bad Debt</p>
                <p className="text-2xl font-bold text-white">${protocolStats.badDebt.toLocaleString()}</p>
              </div>
              <div className="w-10 h-10 bg-red-900/20 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
            </div>
          </div>

          <div className="bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">System Health</p>
                <p className="text-2xl font-bold text-white">{protocolStats.systemHealth.toFixed(1)}%</p>
              </div>
              <div className="w-10 h-10 bg-green-900/20 rounded-full flex items-center justify-center">
                <Activity className="w-5 h-5 text-green-400" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Position Overview */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-6">Your Position</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Total Deposit</p>
              <p className="text-2xl font-bold text-white">{position.totalDeposit.toFixed(2)}</p>
              <p className="text-xs text-gray-500">ADA</p>
            </div>
            <div className="w-10 h-10 bg-blue-900/20 rounded-full flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-blue-400" />
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Total Collateral</p>
              <p className="text-2xl font-bold text-white">{position.totalCollateral.toFixed(2)}</p>
              <p className="text-xs text-gray-500">ADA</p>
            </div>
            <div className="w-10 h-10 bg-teal-900/20 rounded-full flex items-center justify-center">
              <Shield className="w-5 h-5 text-teal-400" />
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Minted ST</p>
              <p className="text-2xl font-bold text-white">{position.mintedST.toFixed(2)}</p>
              <p className="text-xs text-gray-500">Statera Tokens</p>
            </div>
            <div className="w-10 h-10 bg-purple-900/20 rounded-full flex items-center justify-center">
              <Coins className="w-5 h-5 text-purple-400" />
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Health Factor</p>
              <p className="text-2xl font-bold text-white">{position.healthFactor.toFixed(2)}</p>
              <div className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getHealthFactorColor(position.healthFactor)}`}>
                {position.healthFactor >= 2 ? 'Safe' : position.healthFactor >= 1.5 ? 'Moderate' : position.healthFactor < 1.5 ? 'Risk' : ''}
              </div>
            </div>
            <div className="w-10 h-10 bg-orange-900/20 rounded-full flex items-center justify-center">
              <ArrowUpDown className="w-5 h-5 text-orange-400" />
            </div>
          </div>
        </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-gray-800 rounded-xl shadow-lg border border-gray-700">
        <div className="p-6 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-white">Recent Activity</h3>
        </div>
        <div className="divide-y divide-gray-700">
          {transactions.map((tx) => (
            <div key={tx.id} className="p-6 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  tx.type === 'deposit' ? 'bg-green-900/20' :
                  tx.type === 'withdraw' ? 'bg-red-900/20' :
                  tx.type === 'mint' ? 'bg-purple-900/20' :
                  tx.type === 'repay' ? 'bg-blue-900/20' : 'bg-orange-900/20'
                }`}>
                  {tx.type === 'deposit' && <TrendingUp className="w-5 h-5 text-green-400" />}
                  {tx.type === 'withdraw' && <TrendingUp className="w-5 h-5 text-red-400 rotate-180" />}
                  {tx.type === 'mint' && <Coins className="w-5 h-5 text-purple-400" />}
                  {tx.type === 'repay' && <Shield className="w-5 h-5 text-blue-400" />}
                  {tx.type === 'swap' && <ArrowUpDown className="w-5 h-5 text-yellow-400" />}
                  {tx.type === 'swap' && <ArrowUpDown className="w-5 h-5 text-orange-400" />}
                </div>
                <div>
                  <p className="font-medium text-white capitalize">{tx.type}</p>
                  <p className="text-sm text-gray-400">{tx.timestamp.toLocaleDateString()}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-white">{tx.amount.toFixed(2)} {tx.token}</p>
                <div className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                  tx.status === 'completed' ? 'text-green-400 bg-green-900/20' :
                  tx.status === 'pending' ? 'text-yellow-400 bg-yellow-900/20' :
                  'text-red-400 bg-red-900/20'
                }`}>
                  {tx.status}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;