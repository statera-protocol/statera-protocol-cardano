use aiken/collection/dict
use aiken/crypto.{ScriptHash, VerificationKeyHash}
use cardano/assets.{AssetName, PolicyId, lovelace_of, quantity_of}
use cardano/transaction.{InlineDatum, Input, OutputReference, Transaction}
use halalend/datums.{CollateralDatum, ProtocolParametersDatum}
use halalend/utils.{
  calculate_by_percentage, find_input_by_script_hash, is_loan_term_end,
  signed_by,
}

pub type Action {
  Refund
  Liquidate
}

validator collateral_validator(
  admin: VerificationKeyHash,
  protocol_parameters_hash: ScriptHash,
  oracle_hash: ScriptHash,
) {
  spend(
    datum: Option<CollateralDatum>,
    redeemer: Action,
    _o: OutputReference,
    self: Transaction,
  ) {
    let Transaction {
      mint,
      validity_range,
      extra_signatories,
      reference_inputs,
      ..
    } = self

    expect Some(CollateralDatum {
      tusd_policy_id,
      tusd_asset_name,
      collateral_nft_pid,
      collateral_rate_in_lovelace,
      loan_term,
      ..
    }) = datum

    when redeemer is {
      Refund -> {
        expect [Pair(_, quantity)] =
          mint |> assets.tokens(collateral_nft_pid) |> dict.to_pairs

        quantity == -1
      }

      Liquidate -> and {
          is_loan_term_end(validity_range, loan_term),
          signed_by(extra_signatories, admin),
          is_liquidation_threshold_reached(
            protocol_parameters_hash,
            oracle_hash,
            collateral_rate_in_lovelace,
            reference_inputs,
            tusd_policy_id,
            tusd_asset_name,
          ),
        }
    }
  }

  else(_) {
    fail
  }
}

fn is_liquidation_threshold_reached(
  protocol_parameters_hash: ScriptHash,
  oracle_hash: ScriptHash,
  collateral_rate_in_lovelace: Int,
  reference_inputs: List<Input>,
  tusd_policy_id: PolicyId,
  tusd_asset_name: AssetName,
) {
  expect Some(protocol_parameters_ref) =
    find_input_by_script_hash(reference_inputs, protocol_parameters_hash)

  expect InlineDatum(protocol_parameters_datum) =
    protocol_parameters_ref.output.datum

  expect ProtocolParametersDatum {
    min_collateral_ratio,
    min_liquidation_threshold,
    ..
  } = protocol_parameters_datum

  expect Some(oracle_ref) =
    find_input_by_script_hash(reference_inputs, oracle_hash)

  let oracle_lovelace_value = lovelace_of(oracle_ref.output.value)
  let oracle_usd_value =
    quantity_of(oracle_ref.output.value, tusd_policy_id, tusd_asset_name)
  let oracle_lovelace_usd_rate = oracle_lovelace_value / oracle_usd_value

  let liquidation_rate =
    calculate_by_percentage(
      collateral_rate_in_lovelace,
      min_collateral_ratio,
      min_liquidation_threshold,
    )

  oracle_lovelace_usd_rate <= liquidation_rate
}
