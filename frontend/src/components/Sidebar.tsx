import React from 'react';
import { Home, PiggyBank, Shield, ArrowUpDown, Settings, Menu, X, Wallet } from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  isAdmin: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  isCollapsed,
  setIsCollapsed,
  isAdmin,
}) => {
  const tabs = [
    { id: 'dashboard', name: 'Dashboard', icon: Home },
    { id: 'deposits', name: 'Deposits', icon: PiggyBank },
    { id: 'collateral', name: 'Loans', icon: Shield },
    { id: 'swap', name: 'Swap', icon: ArrowUpDown },
  ];

  if (isAdmin) {
    tabs.push({ id: 'admin', name: 'Admin', icon: Settings });
  }

  return (
    <>
      {/* Mobile overlay */}
      {!isCollapsed && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsCollapsed(true)}
        />
      )}
      
      {/* Sidebar */}
      <div className={`fixed left-0 top-0 h-full bg-gray-900 border-r border-gray-700 z-50 transition-all duration-300 ${
        isCollapsed ? '-translate-x-full lg:translate-x-0 lg:w-16' : 'w-64'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          {!isCollapsed && (
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Wallet className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-bold text-white">Statera</h1>
            </div>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            {isCollapsed ? <Menu className="w-5 h-5" /> : <X className="w-5 h-5" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center space-x-3 px-3 py-3 rounded-lg transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:text-white hover:bg-gray-800'
                } ${isCollapsed ? 'justify-center' : ''}`}
                title={isCollapsed ? tab.name : ''}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!isCollapsed && <span className="font-medium">{tab.name}</span>}
              </button>
            );
          })}
        </nav>
      </div>
    </>
  );
};

export default Sidebar;