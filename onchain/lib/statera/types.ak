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
