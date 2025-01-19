use aiken/crypto.{ScriptHash, VerificationKeyHash}
use cardano/assets.{AssetName, PolicyId}

pub type ProtocolParametersDatum {
  min_collateral_ratio: Int,
  min_liquidation_threshold: Int,
  min_loan_amount: Int,
  protocol_usage_fee: Int,
  collateral_assets: List<ByteArray>,
}

pub type CollateralValidatorDatum {
  CollateralDatum {
    tusd_pool_hash: ScriptHash,
    tusd_policy_id: PolicyId,
    tusd_asset_name: AssetName,
    tusd_borrowed: Int,
    loan_nft_pid: PolicyId,
    loan_nft_asset_name: AssetName,
    collateral_rate_in_lovelace: Int,
    collateral_asset: ByteArray,
    collateral_amount_in_lovelace: Int,
  }
  DepositorDatum { depositor_vkh: VerificationKeyHash }
}
