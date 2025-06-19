use cardano/address.{Address, Script}
use cardano/assets.{from_asset, from_lovelace}
use cardano/transaction.{InlineDatum, Input, Output}
use mocktail/virgin_key_hash.{
  mock_policy_id, mock_pub_key_hash, mock_script_hash,
}
use mocktail/virgin_output_reference.{mock_utxo_ref}
use statera/constants.{st_pparams_asset_name, st_stable_asset_name}
use statera/datums.{ProtocolParametersDatum}
use statera/types.{AssetType}

pub fn get_protocol_parameters_ref() {
  let unified_control_validator_hash = mock_script_hash(1)

  let protocol_parameters_ref =
    Input {
      output_reference: mock_utxo_ref(0, 1),
      output: Output {
        address: Address {
          payment_credential: Script(unified_control_validator_hash),
          stake_credential: None,
        },
        value: assets.merge(
          from_lovelace(2000000),
          from_asset(unified_control_validator_hash, st_pparams_asset_name, 1),
        ),
        datum: InlineDatum(
          ProtocolParametersDatum {
            min_collateral_ratio: 150,
            min_liquidation_threshold: 120,
            min_loan_amount: 10,
            protocol_usage_fee: 2,
            st_asset: AssetType {
              is_stable: True,
              policy_id: mock_policy_id(21),
              asset_name: st_stable_asset_name,
            },
            collateral_assets: [
              AssetType {
                is_stable: False,
                policy_id: "",
                asset_name: "lovelace",
              },
              AssetType {
                is_stable: True,
                policy_id: mock_policy_id(8),
                asset_name: "iUSD",
              },
              AssetType {
                is_stable: False,
                policy_id: mock_policy_id(7),
                asset_name: "hosky",
              },
            ],
            swappable_assets: [
              AssetType {
                is_stable: True,
                policy_id: mock_policy_id(13),
                asset_name: "usdm",
              },
            ],
            authorized_batchers: [mock_pub_key_hash(0)],
          },
        ),
        reference_script: None,
      },
    }

  protocol_parameters_ref
}
