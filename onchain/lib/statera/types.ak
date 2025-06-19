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
  Refund
  Liquidate
  WithdrawDeposit
  IncreaseDeposit
  PartialWithdrawal
  IncreaseCollateral
  PartialRepayment
}

pub type MintStRedeemer {
  GetLoan
  RepayLoan
  PartialRepay
  Swap
}

pub type PoolBatchingRedeemer {
  batcher_index: Int,
  pool_asset: AssetType,
}

pub type BatchingType =
  (Int, Int)
