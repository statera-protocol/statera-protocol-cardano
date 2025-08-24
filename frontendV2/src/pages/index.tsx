import React, { useState, useEffect } from 'react';
import { Wallet, PiggyBank, Shield, ArrowUpDown } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import WalletConnection from '../components/WalletConnection';
import Dashboard from '../components/Dashboard';
import DepositModule from '../components/DepositModule';
import CollateralModule from '../components/CollateralModule';
import SwapModule from '../components/SwapModule';
import AdminModule from '../components/AdminModule';
import { 
  WalletInfo, 
  UserPosition, 
  Transaction, 
  CollateralToken, 
  SwapPair, 
  LoanPosition,
  ProtocolStats,
  ProtocolParameter,
  OracleUTxO,
  LiquidationReceiver,
  SwapOrder,
  ProcessingState
} from '../types';
import { useWalletCustom } from '@/components/WalletConnectionContext';
import { getCollateralAndSwapTokens, getUserBalances, getUserDepositUtxo, getUserLoanUtxos, getUserSwapOrders } from '../../utils/utils';
import { newBalance } from '../../utils/CollateralValidator/newBalance';
import { increaseBalance } from '../../utils/CollateralValidator/increaseBalance';
import { reduceBalance } from '../../utils/CollateralValidator/reduceBalance';
import { withdrawAllBalance } from '../../utils/CollateralValidator/withdrawAllBalance';
import { setup } from '../../utils/setup';
import { takeLoan } from '../../utils/LoanNFT/takeLoan';
import { increaseLoanCollateral } from '../../utils/LoanNFT/increaseLoanCollateral';
import { reduceLoanCollateral } from '../../utils/LoanNFT/reduceLoanCollateral';
import { partialRepayLoan } from '../../utils/LoanNFT/partialRepayLoan';
import { repayLoan } from '../../utils/LoanNFT/repayLoan';
import { createBuyOrder } from '../../utils/Batching/createBuyOrder';
import { createSellOrder } from '../../utils/Batching/createSellOrder';
import { cancelOrder } from '../../utils/Batching/cancelOrder';

function Home() {
  const {
    address, connected, balance, disconnect, walletVK, walletSK, handleWallet,
    txBuilder, wallet, walletCollateral, walletUtxos, blockchainProvider, refreshWalletState,
  } = useWalletCustom();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isProcessing, setIsProcessing] = useState<ProcessingState>({ bool: false, action: 'deposit', });

  // Admin wallets - in real app this would be managed differently
  const adminWallets = ['addr_test1qztvhvnujmd03j4cjr0x6lu87hlaqfdl3tyqw97tcnaw0kk5wsnj53x9v8dhupg6v8rzt48atr6zmrvlppkam7upd29sqeutm7']; // Mock admin wallet
  const [isAdmin, setIsAdmin] = useState(false);

  // Mock data - in real app this would come from Cardano blockchain
  const [userPosition, setUserPosition] = useState<UserPosition>({
    totalDeposit: 0.0,
    totalCollateral: 0.0,
    mintedST: 0.0,
    healthFactor: 0.0,
  });

  const [protocolStats, setProtocolStats] = useState<ProtocolStats>({
    totalValueLocked: 2450000,
    totalSTMinted: 1850000,
    collateralRatio: 165.4,
    badDebt: 12500,
    systemHealth: 98.7,
  });

  const [transactions, setTransactions] = useState<Transaction[]>([
    // {
    //   id: '1',
    //   type: 'deposit',
    //   amount: 250.0,
    //   token: 'ADA',
    //   timestamp: new Date(Date.now() - 86400000),
    //   status: 'completed',
    // },
    // {
    //   id: '2',
    //   type: 'mint',
    //   amount: 200.0,
    //   token: 'ST',
    //   timestamp: new Date(Date.now() - 172800000),
    //   status: 'completed',
    // },
    // {
    //   id: '3',
    //   type: 'swap',
    //   amount: 100.0,
    //   token: 'USDC',
    //   timestamp: new Date(Date.now() - 259200000),
    //   status: 'completed',
    // },
  ]);

  const [userBalances, setUserBalances] = useState<{ [token: string]: number }>({
    ADA: 0.00,
    iUSD: 0.00,
    USDM: 0.00,
    ST: 0.00,
  });

  const [swapOrders, setSwapOrders] = useState<SwapOrder[]>([]);

  const [loanPositions, setLoanPositions] = useState<LoanPosition[]>([]);

  // Admin data
  const [protocolParameters, setProtocolParameters] = useState<ProtocolParameter[]>([
    {
      id: '1',
      name: 'MAX_LTV_RATIO',
      value: '75',
      description: 'Maximum loan-to-value ratio for collateral',
      lastUpdated: new Date(),
    },
    {
      id: '2',
      name: 'LIQUIDATION_THRESHOLD',
      value: '80',
      description: 'Threshold for liquidation trigger',
      lastUpdated: new Date(),
    },
    {
      id: '3',
      name: 'STABILITY_FEE',
      value: '2.5',
      description: 'Annual stability fee percentage',
      lastUpdated: new Date(),
    },
  ]);

  const [oracleUTxOs, setOracleUTxOs] = useState<OracleUTxO[]>([
    {
      id: '1',
      token: 'ADA',
      price: 0.45,
      lastUpdated: new Date(),
      status: 'active',
    },
    {
      id: '2',
      token: 'USDC',
      price: 1.0,
      lastUpdated: new Date(),
      status: 'active',
    },
    {
      id: '3',
      token: 'USDT',
      price: 1.0,
      lastUpdated: new Date(),
      status: 'active',
    },
  ]);

  const [liquidationReceivers, setLiquidationReceivers] = useState<LiquidationReceiver[]>([
    {
      id: '1',
      address: 'addr1qxy2op6x...abc123',
      name: 'Primary Liquidation Pool',
      isActive: true,
    },
    {
      id: '2',
      address: 'addr1qzw3er7y...def456',
      name: 'Secondary Reserve Pool',
      isActive: false,
    },
  ]);

  const [collateralTokens, setCollateralTokens] = useState<CollateralToken[]>([]);

  const [swapTokens, setSwapTokens] = useState<string[]>([]);

  const swapPairs: SwapPair[] = [
    { from: 'iUSD', to: 'ST', rate: 1.00, available: true },
    { from: 'ST', to: 'iUSD', rate: 1.00, available: true },
    { from: 'USDM', to: 'ST', rate: 1.00, available: true },
    { from: 'ST', to: 'USDM', rate: 1.00, available: true },
  ];

  // update application state on startup
  useEffect(() => {
    // set collateral and swap tokens
    const { allowedCollateralTokens, swappableTokens } = getCollateralAndSwapTokens();
    setCollateralTokens(allowedCollateralTokens);
    setSwapTokens(swappableTokens);
  }, []);

  // update user data after wallet is connected
  useEffect(() => {
    (async () => {
      if (connected) {
        refreshWalletState();
        // await handleWallet();

        // get user deposit ADA balance
        const userDepositUtxo = await getUserDepositUtxo(walletVK);
        const userDepositUtxoAda = parseFloat((Number(userDepositUtxo?.output.amount[0].quantity ?? "") / 1000000).toFixed(2));
        console.log("userDepositUtxoAda:", userDepositUtxoAda);

        // get other user balances
        const { iUSDBalance, USDMBalance, STBalance, } = await getUserBalances(wallet);

        // update user balances
        setUserBalances(prev => ({
          ...prev,
          ADA: parseFloat((Number(balance[0]?.quantity ?? "") / 1000000).toFixed(2)),
          iUSD: iUSDBalance,
          USDM: USDMBalance,
          ST: STBalance,
        }));
        // update user loan positions
        const userLoanPositions = await getUserLoanUtxos(walletUtxos);
        setLoanPositions(userLoanPositions);
        // update user swap orders
        const swapOrders = await getUserSwapOrders(address);
        setSwapOrders(swapOrders);

        let totalCollateral = 0.00;
        let totalMintedSt = 0.00;
        let averageLoanHealth = 0.00;

        for (let i = 0; i < userLoanPositions.length; i++) {
          totalCollateral += userLoanPositions[i].collateralAmount;
          totalMintedSt += userLoanPositions[i].mintedST;
          averageLoanHealth += userLoanPositions[i].healthFactor;
        }
        averageLoanHealth /= userLoanPositions.length;

        // udate user total deposit
        setUserPosition(({
          totalDeposit: userDepositUtxoAda,
          totalCollateral,
          mintedST: totalMintedSt,
          healthFactor: averageLoanHealth,
        }));

        // Set the admin tab visibility
        setIsAdmin(adminWallets.includes(address));
      }
    })();
  }, [wallet, connected, walletVK, isProcessing.bool])

  // handle wallet disconnect
  const handleWalletDisconnect = () => {
    disconnect();
    setActiveTab('dashboard');
  };

  // handle new deposit
  const handleNewDeposit = async (amount: number) => {
    setIsProcessing({ bool: true, action: 'deposit', });

    if (!txBuilder || !walletCollateral || !blockchainProvider) {
      throw new Error("txBuilder or walletCollateral or blockchainProvider is null")
    };

    let txHash = "";
    try {
      txHash = await newBalance(
        txBuilder,
        wallet,
        address,
        walletCollateral,
        walletUtxos,
        walletVK,
        amount,
      );
    } catch (err) {
      txBuilder.reset();
      setIsProcessing({ bool: false, action: 'deposit', });
      console.log("handleNewDeposit error:", err);
      return;
    }

    blockchainProvider.onTxConfirmed(txHash, () => {
      setIsProcessing({ bool: false, action: 'deposit', });
      console.log("New balance txHash:", txHash);
    });
  };

  // handle increase deposit
  const handleIncreaseDeposit = async (amount: number) => {
    setIsProcessing({ bool: true, action: 'deposit', });

    if (!txBuilder || !walletCollateral || !blockchainProvider) {
      throw new Error("txBuilder or walletCollateral or blockchainProvider is null")
    };

    let txHash = "";
    try {
      txHash = await increaseBalance(
        txBuilder,
        wallet,
        address,
        walletCollateral,
        walletUtxos,
        walletVK,
        amount,
      );
    } catch (err) {
      txBuilder.reset();
      setIsProcessing({ bool: false, action: 'deposit', });
      console.log("handleIncreaseDeposit error:", err);
      return;
    }

    blockchainProvider.onTxConfirmed(txHash, () => {
      setIsProcessing({ bool: false, action: 'deposit', });
      console.log("Increase balance txHash:", txHash);
    });
  };

  // handle withdraw deposit
  const handleWithdrawDeposit = async (amount: number) => {
    setIsProcessing({ bool: true, action: 'deposit', });

    if (!txBuilder || !walletCollateral || !blockchainProvider) {
      throw new Error("txBuilder or walletCollateral or blockchainProvider is null")
    };

    let txHash = "";
    try {
      txHash = await reduceBalance(
        txBuilder,
        wallet,
        address,
        walletCollateral,
        walletUtxos,
        walletVK,
        amount,
      );
    } catch (err) {
      txBuilder.reset();
      setIsProcessing({ bool: false, action: 'deposit', });
      console.log("handleWithdrawDeposit error:", err);
      return;
    }

    blockchainProvider.onTxConfirmed(txHash, () => {
      setIsProcessing({ bool: false, action: 'deposit', });
      console.log("Reduce balance txHash:", txHash);
    });
  };

  // const handleWithdraw = (amount: number) => {
  //   setUserPosition(prev => ({
  //     ...prev,
  //     totalDeposit: Math.max(0, prev.totalDeposit - amount),
  //   }));
    
  //   setUserBalances(prev => ({
  //     ...prev,
  //     ADA: prev.ADA + amount,
  //   }));

  //   const newTransaction: Transaction = {
  //     id: Date.now().toString(),
  //     type: 'withdraw',
  //     amount,
  //     token: 'ADA',
  //     timestamp: new Date(),
  //     status: 'completed',
  //   };
  //   setTransactions(prev => [newTransaction, ...prev]);
  // };

  const handleCloseAccount = async () => {
    setIsProcessing({ bool: true, action: 'deposit', });

    if (!txBuilder || !walletCollateral || !blockchainProvider) {
      throw new Error("txBuilder or walletCollateral or blockchainProvider is null")
    };

    let txHash = "";
    try {
      txHash = await withdrawAllBalance(
        txBuilder,
        wallet,
        address,
        walletCollateral,
        walletUtxos,
        walletVK,
      );
    } catch (err) {
      txBuilder.reset();
      setIsProcessing({ bool: false, action: 'deposit', });
      console.log("handleCloseAccount error:", err);
      return;
    }

    blockchainProvider.onTxConfirmed(txHash, () => {
      setIsProcessing({ bool: false, action: 'deposit', });
      console.log("Withdraw all balance txHash:", txHash);
    });
  };

  const handleCreateLoan = async (token: string, collateralAmount: number, mintAmount: number) => {
    setIsProcessing({ bool: true, action: 'loan', });

    if (!txBuilder || !walletCollateral || !blockchainProvider) {
      throw new Error("txBuilder or walletCollateral or blockchainProvider is null")
    };

    const { assetObject } = setup();
    const collateralAsset = assetObject[token];

    let txHash = "";
    try {
      txHash = await takeLoan(
        txBuilder,
        wallet,
        address,
        walletCollateral,
        walletUtxos,
        walletVK,
        collateralAsset,
        collateralAmount * 1000000,
        mintAmount * 1000000,
      );
    } catch (err) {
      txBuilder.reset();
      setIsProcessing({ bool: false, action: 'loan', });
      console.log("handleCreateLoan error:", err);
      return;
    }

    blockchainProvider.onTxConfirmed(txHash, () => {
      setIsProcessing({ bool: false, action: 'loan', });
      console.log('Take loan txHash:', txHash);
    });

    // console.log(token, collateralAmount, mintAmount);

    // const newLoan: LoanPosition = {
    //   id: Date.now().toString(),
    //   collateralToken: token,
    //   collateralAmount,
    //   mintedST: mintAmount,
    //   healthFactor: calculateHealthFactor(collateralAmount, mintAmount),
    //   createdAt: new Date(),
    // };
    
    // setLoanPositions(prev => [...prev, newLoan]);
    
    // // Update balances
    // setUserBalances(prev => ({
    //   ...prev,
    //   [token]: prev[token] - collateralAmount,
    //   ST: prev.ST + mintAmount,
    // }));
    
    // // Update user position
    // const tokenInfo = collateralTokens.find(t => t.symbol === token);
    // if (tokenInfo) {
    //   setUserPosition(prev => ({
    //     ...prev,
    //     totalCollateral: prev.totalCollateral + (collateralAmount * tokenInfo.price),
    //     mintedST: prev.mintedST + mintAmount,
    //   }));
    // }
  };

  const handleModifyLoan = (loanId: string, action: 'addCollateral' | 'removeCollateral' | 'repay' | 'fullRepay', amount: number) => {
      if (action === 'addCollateral') {
        handleIncreaseCollateral(loanId, amount);
      } else if (action === 'removeCollateral') {
        handleReduceCollateral(loanId, amount);
      } else if (action === 'repay') {
        handlePartialRepayLoan(loanId, amount);
      } else if (action === 'fullRepay') {
        handleFullRepayLoan(loanId);
      }

    // setLoanPositions(prev => prev.map(loan => {
    //   if (loan.id !== loanId) return loan;
      
    //   let updatedLoan = { ...loan };
      
    //   if (action === 'addCollateral') {
    //     handleIncreaseCollateral(loan.id, amount);
    //     // updatedLoan.collateralAmount += amount;
    //     // setUserBalances(prev => ({
    //     //   ...prev,
    //     //   [loan.collateralToken]: prev[loan.collateralToken] - amount,
    //     // }));
    //   } else if (action === 'removeCollateral') {
    //     updatedLoan.collateralAmount = Math.max(0, updatedLoan.collateralAmount - amount);
    //     setUserBalances(prev => ({
    //       ...prev,
    //       [loan.collateralToken]: prev[loan.collateralToken] + amount,
    //     }));
    //   } else if (action === 'repay') {
    //     updatedLoan.mintedST = Math.max(0, updatedLoan.mintedST - amount);
    //     setUserBalances(prev => ({
    //       ...prev,
    //       ST: prev.ST - amount,
    //     }));
    //   } else if (action === 'fullRepay') {
    //     const repayAmount = updatedLoan.mintedST;
    //     updatedLoan.mintedST = 0;
    //     setUserBalances(prev => ({
    //       ...prev,
    //       ST: prev.ST - repayAmount,
    //     }));
    //   }
      
    //   updatedLoan.healthFactor = calculateHealthFactor(updatedLoan.collateralAmount, updatedLoan.mintedST);
    //   return updatedLoan;
    // }));
  };

  const handleIncreaseCollateral = async (loanId: string, amount: number) => {
    setIsProcessing({ bool: true, action: 'loan', });

    if (!txBuilder || !walletCollateral || !blockchainProvider) {
      throw new Error("txBuilder or walletCollateral or blockchainProvider is null")
    };

    const loan = loanPositions.find(loanPos => loanPos.id === loanId);
    if (!loan || !loan.collateralUtxo) throw new Error("Loan or loan's collateral Utxo is undefined!");

    let txHash = "";
    try {
      txHash = await increaseLoanCollateral(
        txBuilder,
        wallet,
        address,
        walletCollateral,
        walletUtxos,
        walletVK,
        amount,
        loan.collateralUtxo,
      );
    } catch (err) {
      txBuilder.reset();
      setIsProcessing({ bool: false, action: 'loan', });
      console.log("handleIncreaseCollateral error:", err);
      return;
    }

    blockchainProvider.onTxConfirmed(txHash, () => {
      setIsProcessing({ bool: false, action: 'loan', });
      console.log("Increase collateral txHash:", txHash);
    });
  };

  const handleReduceCollateral = async (loanId: string, amount: number) => {
    setIsProcessing({ bool: true, action: 'loan', });

    if (!txBuilder || !walletCollateral || !blockchainProvider) {
      throw new Error("txBuilder or walletCollateral or blockchainProvider is null")
    };

    const loan = loanPositions.find(loanPos => loanPos.id === loanId);
    if (!loan || !loan.collateralUtxo) throw new Error("Loan or loan's collateral Utxo is undefined!");

    let txHash = "";
    try {
      txHash = await reduceLoanCollateral(
        txBuilder,
        wallet,
        address,
        walletCollateral,
        walletUtxos,
        walletVK,
        amount,
        loan.collateralUtxo,
      );
    } catch (err) {
      txBuilder.reset();
      setIsProcessing({ bool: false, action: 'loan', });
      console.log("handleReduceCollateral error:", err);
      return;
    }

    blockchainProvider.onTxConfirmed(txHash, () => {
      setIsProcessing({ bool: false, action: 'loan', });
      console.log("Reduce collateral txHash:", txHash);
    });
  };

  const handlePartialRepayLoan = async (loanId: string, amount: number) => {
   setIsProcessing({ bool: true, action: 'loan', });

    if (!txBuilder || !walletCollateral || !blockchainProvider) {
      throw new Error("txBuilder or walletCollateral or blockchainProvider is null")
    };

    const loan = loanPositions.find(loanPos => loanPos.id === loanId);
    if (!loan || !loan.collateralUtxo) throw new Error("Loan or loan's collateral Utxo is undefined!");

    let txHash = "";
    try {
      txHash = await partialRepayLoan(
        txBuilder,
        wallet,
        address,
        walletCollateral,
        walletUtxos,
        amount,
        loan.collateralUtxo,
      );
    } catch (err) {
      txBuilder.reset();
      setIsProcessing({ bool: false, action: 'loan', });
      console.log("handlePartialRepayLoan error:", err);
      return;
    }

    blockchainProvider.onTxConfirmed(txHash, () => {
      setIsProcessing({ bool: false, action: 'loan', });
      console.log("Partial repay loan txHash:", txHash);
    });
  };

  const handleFullRepayLoan = async (loanId: string) => {
    setIsProcessing({ bool: true, action: 'loan', });

    if (!txBuilder || !walletCollateral || !blockchainProvider) {
      throw new Error("txBuilder or walletCollateral or blockchainProvider is null")
    };

    const loan = loanPositions.find(loanPos => loanPos.id === loanId);
    if (!loan || !loan.collateralUtxo) throw new Error("Loan or loan's collateral Utxo is undefined!");

    const { assetObject } = setup();
    const collateralAsset = assetObject[loan.collateralToken];

    let txHash = "";
    try {
      txHash = await repayLoan(
        blockchainProvider,
        txBuilder,
        wallet,
        address,
        walletCollateral,
        walletUtxos,
        walletVK,
        loan.collateralUtxo,
        collateralAsset,
      );
    } catch (err) {
      txBuilder.reset();
      setIsProcessing({ bool: false, action: 'loan', });
      console.log("handleFullRepayLoan error:", err);
      return;
    }

    blockchainProvider.onTxConfirmed(txHash, () => {
      setIsProcessing({ bool: false, action: 'loan', });
      console.log('Full Repayment tx hash:', txHash);
    });
  };

  const handleDeleteLoan = (loanId: string) => {
    const loan = loanPositions.find(l => l.id === loanId);
    if (loan) {
      // Return collateral to user
      setUserBalances(prev => ({
        ...prev,
        [loan.collateralToken]: prev[loan.collateralToken] + loan.collateralAmount,
      }));
      
      // Remove from loan positions
      setLoanPositions(prev => prev.filter(l => l.id !== loanId));
    }
  };

  // Admin handlers
  const handleUpdateParameter = (id: string, value: string) => {
    setProtocolParameters(prev => prev.map(param => 
      param.id === id ? { ...param, value, lastUpdated: new Date() } : param
    ));
  };

  const handleCreateParameter = (name: string, value: string, description: string) => {
    const newParam: ProtocolParameter = {
      id: Date.now().toString(),
      name,
      value,
      description,
      lastUpdated: new Date(),
    };
    setProtocolParameters(prev => [...prev, newParam]);
  };

  const handleDeleteParameter = (id: string) => {
    setProtocolParameters(prev => prev.filter(param => param.id !== id));
  };

  const handleUpdateOracle = (id: string, price: number) => {
    setOracleUTxOs(prev => prev.map(oracle => 
      oracle.id === id ? { ...oracle, price, lastUpdated: new Date() } : oracle
    ));
  };

  const handleCreateOracle = (token: string, price: number) => {
    const newOracle: OracleUTxO = {
      id: Date.now().toString(),
      token,
      price,
      lastUpdated: new Date(),
      status: 'active',
    };
    setOracleUTxOs(prev => [...prev, newOracle]);
  };

  const handleDeleteOracle = (id: string) => {
    setOracleUTxOs(prev => prev.filter(oracle => oracle.id !== id));
  };

  const handleUpdateReceiver = (id: string, address: string, name: string, isActive: boolean) => {
    setLiquidationReceivers(prev => prev.map(receiver => 
      receiver.id === id ? { ...receiver, address, name, isActive } : receiver
    ));
  };

  const handleCreateReceiver = (address: string, name: string) => {
    const newReceiver: LiquidationReceiver = {
      id: Date.now().toString(),
      address,
      name,
      isActive: true,
    };
    setLiquidationReceivers(prev => [...prev, newReceiver]);
  };

  const handleDeleteReceiver = (id: string) => {
    setLiquidationReceivers(prev => prev.filter(receiver => receiver.id !== id));
  };

  const handleSwap = (fromToken: string, toToken: string, amount: number) => {
    const pair = swapPairs.find(p => p.from === fromToken && p.to === toToken);
    if (!pair) return;

    const toAmount = amount * pair.rate;

    if (fromToken !== "ST") {
      handleBuySwap(toAmount, fromToken);
    } else {
      handleSellSwap(toAmount, toToken);
    }

    // setUserBalances(prev => ({
    //   ...prev,
    //   [fromToken]: prev[fromToken] - amount,
    //   [toToken]: prev[toToken] + toAmount,
    // }));

    // const newTransaction: Transaction = {
    //   id: Date.now().toString(),
    //   type: 'swap',
    //   amount,
    //   token: fromToken,
    //   timestamp: new Date(),
    //   status: 'completed',
    // };
    // setTransactions(prev => [newTransaction, ...prev]);
  };

  const handleBuySwap = async (amount: number, assetName: string) => {
    setIsProcessing({ bool: true, action: 'swap', });

    if (!txBuilder || !walletCollateral || !blockchainProvider) {
      throw new Error("txBuilder or walletCollateral or blockchainProvider is null")
    };

    let txHash = "";
    try {
      txHash = await createBuyOrder(
        txBuilder,
        wallet,
        address,
        walletUtxos,
        walletVK,
        walletSK,
        amount,
        assetName,
      );
    } catch (err) {
      txBuilder.reset();
      setIsProcessing({ bool: false, action: 'swap', });
      console.log("Create buy order:", txHash);
      return;
    }

    blockchainProvider.onTxConfirmed(txHash, () => {
      setIsProcessing({ bool: false, action: 'swap', });
      console.log("Create buy order:", txHash);
    });
  }

  const handleSellSwap = async (amount: number, assetName: string) => {
    setIsProcessing({ bool: true, action: 'swap', });

    if (!txBuilder || !walletCollateral || !blockchainProvider) {
      throw new Error("txBuilder or walletCollateral or blockchainProvider is null")
    };

    let txHash = "";
    try {
      txHash = await createSellOrder(
        txBuilder,
        wallet,
        address,
        walletUtxos,
        walletVK,
        walletSK,
        amount,
        assetName,
      );
    } catch (err) {
      txBuilder.reset();
      setIsProcessing({ bool: false, action: 'swap', });
      console.log("Create sell order:", txHash);
      return;
    }

    blockchainProvider.onTxConfirmed(txHash, () => {
      setIsProcessing({ bool: false, action: 'swap', });
      console.log("Create sell order:", txHash);
    });
  }

  const handleCancelSwap = async (orderId: string) => {
    const order = swapOrders.find(o => o.id === orderId);

    setIsProcessing({ bool: true, action: 'swap', });

    if (!txBuilder || !walletCollateral || !blockchainProvider || !order) {
      throw new Error("txBuilder or walletCollateral or blockchainProvider or order is null")
    };

    let txHash = "";
    try {
      txHash = await cancelOrder(
        txBuilder,
        wallet,
        walletUtxos,
        walletCollateral,
        order.utxo,
        order.canceller,
        address,
      );
    } catch (err) {
      txBuilder.reset();
      setIsProcessing({ bool: false, action: 'swap', });
      console.log("Cancel order:", txHash);
      return;
    }

    blockchainProvider.onTxConfirmed(txHash, () => {
      setIsProcessing({ bool: false, action: 'swap', });
      console.log("Cancel order:", txHash);
    });

    // const order = swapOrders.find(o => o.id === orderId);
    // if (!order || order.status !== 'pending') return;

    // // Return the locked tokens to user balance
    // setUserBalances(prev => ({
    //   ...prev,
    //   [order.fromToken]: prev[order.fromToken] + order.fromAmount,
    // }));

    // // Update swap order status
    // setSwapOrders(prev => prev.map(o => 
    //   o.id === orderId ? { ...o, status: 'cancelled' } : o
    // ));

    // // Update transaction status
    // setTransactions(prev => prev.map(tx => 
    //   tx.id === orderId ? { ...tx, status: 'failed' } : tx
    // ));
  };

  if (!connected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <div className="container mx-auto px-4 py-12">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="flex items-center justify-center space-x-3 mb-4">
              <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
                <Wallet className="w-7 h-7 text-white" />
              </div>
              <h1 className="text-4xl font-bold text-white">Statera</h1>
            </div>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              The premier DeFi platform on Cardano for collateral-backed stable coin minting and seamless token swapping
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            <div className="bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-700 text-center">
              <div className="w-12 h-12 bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <PiggyBank className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Secure Deposits</h3>
              <p className="text-gray-400">Deposit ADA and earn while maintaining full control of your assets</p>
            </div>

            <div className="bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-700 text-center">
              <div className="w-12 h-12 bg-teal-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="w-6 h-6 text-teal-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Collateral Minting</h3>
              <p className="text-gray-400">Use your crypto as collateral to mint Statera stable coins</p>
            </div>

            <div className="bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-700 text-center">
              <div className="w-12 h-12 bg-purple-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <ArrowUpDown className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Token Swapping</h3>
              <p className="text-gray-400">Seamlessly swap between stable coins and Statera tokens</p>
            </div>
          </div>

          {/* Wallet Connection */}
          <div className="max-w-md mx-auto">
            <WalletConnection
              onDisconnect={handleWalletDisconnect}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex">
      {/* Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isCollapsed={sidebarCollapsed}
        setIsCollapsed={setSidebarCollapsed}
        isAdmin={isAdmin}
      />

      {/* Main Content */}
      <div className={`flex-1 transition-all duration-300 ${sidebarCollapsed ? 'lg:ml-16' : 'ml-0 lg:ml-64'}`}>
      {/* Header */}
      <header className="bg-gray-800 shadow-sm border-b border-gray-700">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 lg:hidden">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                <Wallet className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-white">Statera</h1>
            </div>
            <div className="ml-auto">
              <WalletConnection
                onDisconnect={handleWalletDisconnect}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {activeTab === 'dashboard' && (
          <Dashboard 
            position={userPosition} 
            transactions={transactions} 
            protocolStats={protocolStats}
          />
        )}
        
        {activeTab === 'deposits' && (
          <DepositModule
            currentDeposit={userPosition.totalDeposit}
            availableBalance={parseFloat((Number(balance[0]?.quantity ?? "") / 1000000).toFixed(2))}
            onNewDeposit={handleNewDeposit}
            onDeposit={handleIncreaseDeposit}
            onWithdraw={handleWithdrawDeposit}
            onCloseAccount={handleCloseAccount}
            isProcessing={isProcessing}
          />
        )}
        
        {activeTab === 'collateral' && (
          <CollateralModule
            collateralTokens={collateralTokens}
            loanPositions={loanPositions}
            hasDeposit={userPosition.totalDeposit > 0}
            onCreateLoan={handleCreateLoan}
            onModifyLoan={handleModifyLoan}
            onDeleteLoan={handleDeleteLoan}
            isProcessing={isProcessing}
          />
        )}
        
        {activeTab === 'swap' && (
          <SwapModule
            availableTokens={swapTokens}
            swapPairs={swapPairs}
            userBalances={userBalances}
            swapOrders={swapOrders}
            hasDeposit={userPosition.totalDeposit > 0}
            onSwap={handleSwap}
            onCancelSwap={handleCancelSwap}
            isProcessing={isProcessing}
          />
        )}
        
        {activeTab === 'admin' && isAdmin && (
          <AdminModule
            protocolParameters={protocolParameters}
            oracleUTxOs={oracleUTxOs}
            liquidationReceivers={liquidationReceivers}
            onUpdateParameter={handleUpdateParameter}
            onCreateParameter={handleCreateParameter}
            onDeleteParameter={handleDeleteParameter}
            onUpdateOracle={handleUpdateOracle}
            onCreateOracle={handleCreateOracle}
            onDeleteOracle={handleDeleteOracle}
            onUpdateReceiver={handleUpdateReceiver}
            onCreateReceiver={handleCreateReceiver}
            onDeleteReceiver={handleDeleteReceiver}
          />
        )}
      </main>
      </div>
    </div>
  );
}

export default Home;
