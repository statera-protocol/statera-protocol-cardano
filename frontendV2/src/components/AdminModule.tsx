import React, { useState } from 'react';
import { Settings, Database, Eye, Plus, Edit3, Trash2, Save, X } from 'lucide-react';
import { ProtocolParameter, OracleUTxO, LiquidationReceiver } from '../types';

interface AdminModuleProps {
  protocolParameters: ProtocolParameter[];
  oracleUTxOs: OracleUTxO[];
  liquidationReceivers: LiquidationReceiver[];
  onUpdateParameter: (id: string, value: string) => void;
  onCreateParameter: (name: string, value: string, description: string) => void;
  onDeleteParameter: (id: string) => void;
  onUpdateOracle: (id: string, price: number) => void;
  onCreateOracle: (token: string, price: number) => void;
  onDeleteOracle: (id: string) => void;
  onUpdateReceiver: (id: string, address: string, name: string, isActive: boolean) => void;
  onCreateReceiver: (address: string, name: string) => void;
  onDeleteReceiver: (id: string) => void;
}

const AdminModule: React.FC<AdminModuleProps> = ({
  protocolParameters,
  oracleUTxOs,
  liquidationReceivers,
  onUpdateParameter,
  onCreateParameter,
  onDeleteParameter,
  onUpdateOracle,
  onCreateOracle,
  onDeleteOracle,
  onUpdateReceiver,
  onCreateReceiver,
  onDeleteReceiver,
}) => {
  const [activeTab, setActiveTab] = useState<'parameters' | 'oracles' | 'receivers'>('parameters');
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState<any>({});

  const tabs = [
    { id: 'parameters', name: 'Protocol Parameters', icon: Settings },
    { id: 'oracles', name: 'Oracle UTxOs', icon: Eye },
    { id: 'receivers', name: 'Liquidation Receivers', icon: Database },
  ];

  const handleSave = (id: string, type: string) => {
    if (type === 'parameter') {
      onUpdateParameter(id, formData.value);
    } else if (type === 'oracle') {
      onUpdateOracle(id, parseFloat(formData.price));
    } else if (type === 'receiver') {
      onUpdateReceiver(id, formData.address, formData.name, formData.isActive);
    }
    setEditingItem(null);
    setFormData({});
  };

  const handleCreate = () => {
    if (activeTab === 'parameters') {
      onCreateParameter(formData.name, formData.value, formData.description);
    } else if (activeTab === 'oracles') {
      onCreateOracle(formData.token, parseFloat(formData.price));
    } else if (activeTab === 'receivers') {
      onCreateReceiver(formData.address, formData.name);
    }
    setShowCreateForm(false);
    setFormData({});
  };

  const startEdit = (item: any, type: string) => {
    setEditingItem(item.id);
    if (type === 'parameter') {
      setFormData({ value: item.value });
    } else if (type === 'oracle') {
      setFormData({ price: item.price.toString() });
    } else if (type === 'receiver') {
      setFormData({ address: item.address, name: item.name, isActive: item.isActive });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Admin Panel</h2>
          <p className="text-gray-400 mt-1">Manage protocol parameters and system configuration</p>
        </div>
        <div className="flex items-center space-x-2 bg-red-900/20 px-3 py-2 rounded-lg border border-red-700">
          <Settings className="w-4 h-4 text-red-400" />
          <span className="text-red-400 text-sm font-medium">Admin Access</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-gray-800 rounded-xl border border-gray-700">
        <div className="flex border-b border-gray-700">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 px-6 py-4 font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'text-blue-400 border-b-2 border-blue-400'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.name}</span>
              </button>
            );
          })}
        </div>

        <div className="p-6">
          {/* Create Button */}
          <div className="flex justify-end mb-6">
            <button
              onClick={() => setShowCreateForm(true)}
              className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Create New</span>
            </button>
          </div>

          {/* Protocol Parameters */}
          {activeTab === 'parameters' && (
            <div className="space-y-4">
              {protocolParameters.map((param) => (
                <div key={param.id} className="bg-gray-900 rounded-lg p-4 border border-gray-600">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-white">{param.name}</h4>
                      <p className="text-sm text-gray-400 mt-1">{param.description}</p>
                      {editingItem === param.id ? (
                        <div className="mt-3 flex items-center space-x-2">
                          <input
                            type="text"
                            value={formData.value || ''}
                            onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                            className="px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm"
                          />
                          <button
                            onClick={() => handleSave(param.id, 'parameter')}
                            className="p-2 bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
                          >
                            <Save className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingItem(null)}
                            className="p-2 bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <p className="text-lg font-mono text-blue-400 mt-2">{param.value}</p>
                      )}
                      <p className="text-xs text-gray-500 mt-2">
                        Last updated: {param.lastUpdated.toLocaleDateString()}
                      </p>
                    </div>
                    {editingItem !== param.id && (
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => startEdit(param, 'parameter')}
                          className="p-2 text-gray-400 hover:text-blue-400 hover:bg-gray-800 rounded transition-colors"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onDeleteParameter(param.id)}
                          className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Oracle UTxOs */}
          {activeTab === 'oracles' && (
            <div className="space-y-4">
              {oracleUTxOs.map((oracle) => (
                <div key={oracle.id} className="bg-gray-900 rounded-lg p-4 border border-gray-600">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <h4 className="font-medium text-white">{oracle.token}</h4>
                        <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                          oracle.status === 'active' 
                            ? 'text-green-400 bg-green-900/20' 
                            : 'text-red-400 bg-red-900/20'
                        }`}>
                          {oracle.status}
                        </div>
                      </div>
                      {editingItem === oracle.id ? (
                        <div className="mt-3 flex items-center space-x-2">
                          <span className="text-gray-400">$</span>
                          <input
                            type="number"
                            step="0.000001"
                            value={formData.price || ''}
                            onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                            className="px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm"
                          />
                          <button
                            onClick={() => handleSave(oracle.id, 'oracle')}
                            className="p-2 bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
                          >
                            <Save className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingItem(null)}
                            className="p-2 bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <p className="text-lg font-mono text-green-400 mt-2">${oracle.price.toFixed(6)}</p>
                      )}
                      <p className="text-xs text-gray-500 mt-2">
                        Last updated: {oracle.lastUpdated.toLocaleDateString()}
                      </p>
                    </div>
                    {editingItem !== oracle.id && (
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => startEdit(oracle, 'oracle')}
                          className="p-2 text-gray-400 hover:text-blue-400 hover:bg-gray-800 rounded transition-colors"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onDeleteOracle(oracle.id)}
                          className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Liquidation Receivers */}
          {activeTab === 'receivers' && (
            <div className="space-y-4">
              {liquidationReceivers.map((receiver) => (
                <div key={receiver.id} className="bg-gray-900 rounded-lg p-4 border border-gray-600">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <h4 className="font-medium text-white">{receiver.name}</h4>
                        <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                          receiver.isActive 
                            ? 'text-green-400 bg-green-900/20' 
                            : 'text-gray-400 bg-gray-700'
                        }`}>
                          {receiver.isActive ? 'Active' : 'Inactive'}
                        </div>
                      </div>
                      {editingItem === receiver.id ? (
                        <div className="mt-3 space-y-2">
                          <input
                            type="text"
                            placeholder="Receiver Name"
                            value={formData.name || ''}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm"
                          />
                          <input
                            type="text"
                            placeholder="Cardano Address"
                            value={formData.address || ''}
                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm"
                          />
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={formData.isActive || false}
                              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                              className="rounded"
                            />
                            <span className="text-sm text-gray-400">Active</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleSave(receiver.id, 'receiver')}
                              className="p-2 bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
                            >
                              <Save className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setEditingItem(null)}
                              className="p-2 bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm font-mono text-gray-400 mt-2 break-all">{receiver.address}</p>
                      )}
                    </div>
                    {editingItem !== receiver.id && (
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => startEdit(receiver, 'receiver')}
                          className="p-2 text-gray-400 hover:text-blue-400 hover:bg-gray-800 rounded transition-colors"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onDeleteReceiver(receiver.id)}
                          className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Form Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4 border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-4">
              Create New {activeTab === 'parameters' ? 'Parameter' : activeTab === 'oracles' ? 'Oracle' : 'Receiver'}
            </h3>
            <div className="space-y-4">
              {activeTab === 'parameters' && (
                <>
                  <input
                    type="text"
                    placeholder="Parameter Name"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white"
                  />
                  <input
                    type="text"
                    placeholder="Value"
                    value={formData.value || ''}
                    onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white"
                  />
                  <textarea
                    placeholder="Description"
                    value={formData.description || ''}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white"
                    rows={3}
                  />
                </>
              )}
              {activeTab === 'oracles' && (
                <>
                  <input
                    type="text"
                    placeholder="Token Symbol"
                    value={formData.token || ''}
                    onChange={(e) => setFormData({ ...formData, token: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white"
                  />
                  <input
                    type="number"
                    step="0.000001"
                    placeholder="Price"
                    value={formData.price || ''}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white"
                  />
                </>
              )}
              {activeTab === 'receivers' && (
                <>
                  <input
                    type="text"
                    placeholder="Receiver Name"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white"
                  />
                  <input
                    type="text"
                    placeholder="Cardano Address"
                    value={formData.address || ''}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white"
                  />
                </>
              )}
            </div>
            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateForm(false);
                  setFormData({});
                }}
                className="flex-1 py-2 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminModule;