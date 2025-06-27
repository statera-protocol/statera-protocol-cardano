use aiken/crypto.{ScriptHash, VerificationKeyHash}
use cardano/address.{Address, Credential}
use cardano/assets.{AssetName, PolicyId}
use statera/types.{AssetRate, AssetType}

pub type CollateralValidatorDatum {
  CollateralDatum {
    st_policy_id: PolicyId,
    st_asset_name: AssetName,
    st_borrowed: Int,
    loan_nft_pid: PolicyId,
    loan_nft_asset_name: AssetName,
    // asset per usd precised (multiplied) with 'precision_factor'
    collateral_rate_at_lending_precised: Int,
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
    st_asset: AssetType,
    collateral_assets: List<AssetType>,
    swappable_assets: List<AssetType>,
    authorized_batchers: List<VerificationKeyHash>,
    admin: ScriptHash,
  }
  LiqFundsDatum { receiver: ScriptHash }
}

pub type PoolDatum {
  pool_batching_cred: Credential,
}

pub type OrderType {
  Buy
  Sell
}

pub type OrderDatum {
  order_type: OrderType,
  receiver_address: Address,
  canceller: VerificationKeyHash,
  pool_asset: AssetType,
}
