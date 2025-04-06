use aiken/crypto.{ScriptHash, VerificationKeyHash}
use cardano/assets.{AssetName, PolicyId}
use statera/types.{AssetRate, AssetType}

pub type CollateralValidatorDatum {
  CollateralDatum {
    st_policy_id: PolicyId,
    st_asset_name: AssetName,
    st_borrowed: Int,
    loan_nft_pid: PolicyId,
    loan_nft_asset_name: AssetName,
    collateral_rate_at_lending_precised: Int,
    // asset per usd precised (multiplied) with 'precision_factor'
    collateral_asset: AssetType,
    collateral_asset_amount: Int,
  }
  DepositorDatum { depositor_vkh: VerificationKeyHash }
}

pub type ControlDatum {
  OracleDatum { oracle_rates: List<AssetRate> }
  ProtocolParametersDatum {
    min_collateral_ratio: Int,
    min_liquidation_threshold: Int,
    min_loan_amount: Int,
    protocol_usage_fee: Int,
    collateral_assets: List<AssetType>,
  }
  LiqFundsDatum { receiver: ScriptHash }
}
