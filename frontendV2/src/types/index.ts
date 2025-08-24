import { UTxO } from "@meshsdk/core";

export interface WalletInfo {
  address: string;
  balance: number;
  connected: boolean;
  name: string;
}

export interface UserPosition {
  totalDeposit: number;
  totalCollateral: number;
  mintedST: number;
  healthFactor: number;
}

export interface Transaction {
  id: string;
  type: 'deposit' | 'withdraw' | 'mint' | 'repay' | 'swap';
  amount: number;
  token: string;
  timestamp: Date;
  status: 'pending' | 'completed' | 'failed';
}

export interface SwapOrder {
  id: string;
  fromToken: string;
  toToken: string;
  fromAmount: number;
  expectedToAmount: number;
  rate: number;
  timestamp: Date;
  status: 'pending' | 'executed' | 'cancelled';
  canceller: string;
  utxo: UTxO;
}

export interface CollateralToken {
  symbol: string;
  name: string;
  price: number;
  maxLTV: number;
  liquidationThreshold: number;
}

export interface SwapPair {
  from: string;
  to: string;
  rate: number;
  available: boolean;
}

export interface LoanPosition {
  id: string;
  collateralToken: string;
  collateralAmount: number;
  mintedST: number;
  healthFactor: number;
  createdAt: Date;
  collateralUtxo: UTxO | undefined;
}

export interface ProtocolStats {
  totalValueLocked: number;
  totalSTMinted: number;
  collateralRatio: number;
  badDebt: number;
  systemHealth: number;
}

export interface ProtocolParameter {
  id: string;
  name: string;
  value: string;
  description: string;
  lastUpdated: Date;
}

export interface OracleUTxO {
  id: string;
  token: string;
  price: number;
  lastUpdated: Date;
  status: 'active' | 'inactive';
}

export interface LiquidationReceiver {
  id: string;
  address: string;
  name: string;
  isActive: boolean;
}

export interface ProcessingState {
  bool: boolean;
  action: 'deposit' | 'loan' | 'swap';
}