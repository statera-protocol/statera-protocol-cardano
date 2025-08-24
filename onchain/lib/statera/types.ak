use cardano/assets.{AssetName, PolicyId}

pub type AssetType {
  is_stable: Bool,
  policy_id: PolicyId,
  asset_name: AssetName,
}

pub type AssetRate {
  unit: ByteArray,
  num: Int,
  denum: Int,
}

pub type MintControl {
  InitOracle
  InitProtocolParams
  InitLiqFundsReceiver
  RemoveControlMint
}

pub type SpendControl {
  UpdateOracle
  UpdateProtocolParams
  UpdateLiqFundsReceiver
  RemoveControlSpend
}

pub type CollateralValidatorRedeemer {
  // For user's deposit (User's protocol's balance)
  IncreaseDeposit
  PartialWithdrawDeposit
  WithdrawDeposit
  // For Loan positions
  IncreaseLoanCollateral
  ReduceLoanCollateral
  PartialRepayLoan
  RepayLoan
  LiquidateLoan
}

pub type MintStRedeemer {
  GetLoanSt
  RepayLoanSt
  PartialRepayLoanSt
  SwapSt
}

pub type PoolBatchingRedeemer {
  batcher_index: Int,
  pool_asset: AssetType,
}

pub type BatchingType =
  (Int, Int)

pub type OrderRedeemer {
  CancelOrder
  ProcessOrder
}
