use aiken/crypto.{ScriptHash}
use cardano/assets.{AssetName, PolicyId}

pub type ProtocolParameterDatum {
  min_collateral_ratio: Int,
  min_loan_amount: Int,
  protocol_usage_fee: Int,
  collateral_assets: List<ByteArray>,
  loan_term: Int,
}

pub type CollateralDatum {
  tusd_pool_hash: ScriptHash,
  tusd_policy_id: PolicyId,
  tusd_asset_name: AssetName,
  tusd_borrowed: Int,
  collateral_nft_pid: PolicyId,
  loan_term: Int,
}
