use aiken/collection/dict
use aiken/collection/list
use aiken/crypto.{ScriptHash}
use cardano/address.{Script}
use cardano/assets.{PolicyId, Value, lovelace_of, quantity_of, tokens}
use cardano/transaction.{
  InlineDatum, Input, Output, OutputReference, Transaction, find_input,
}
use halalend/datums.{CollateralDatum, ProtocolParametersDatum}
use halalend/utils.{
  calculate_100_percent_borrow_input_value, find_input_by_script_hash,
}

pub type Action {
  Mint
  Burn
}

validator collateral_nft(
  borrow_utxo: OutputReference,
  collateral_validator_hash: ScriptHash,
  protocol_parameters_hash: ScriptHash,
  oracle_hash: ScriptHash,
) {
  mint(redeemer: Action, _pid: PolicyId, self: Transaction) {
    let Transaction { inputs, outputs, mint, reference_inputs, .. } = self

    when redeemer is {
      Mint ->
        validate_mint_borrow_nft(
          inputs,
          collateral_validator_hash,
          protocol_parameters_hash,
          oracle_hash,
          reference_inputs,
          outputs,
          borrow_utxo,
        )
      Burn ->
        validate_burn_borrow_nft(
          inputs,
          outputs,
          mint,
          collateral_validator_hash,
        )
    }
  }

  else(_) {
    fail
  }
}

fn validate_mint_borrow_nft(
  inputs: List<Input>,
  collateral_validator_hash: ScriptHash,
  protocol_parameters_hash: ScriptHash,
  oracle_hash: ScriptHash,
  reference_inputs: List<Input>,
  outputs: List<Output>,
  borrow_utxo: OutputReference,
) {
  expect Some(collateral_input) =
    find_input_by_script_hash(inputs, collateral_validator_hash)

  expect InlineDatum(collateral_input_datum) = collateral_input.output.datum

  expect CollateralDatum {
    tusd_policy_id,
    tusd_asset_name,
    tusd_borrowed,
    loan_term,
    ..
  } = collateral_input_datum

  expect Some(oracle_ref) =
    find_input_by_script_hash(reference_inputs, oracle_hash)

  expect Some(borrow_input) = find_input(inputs, borrow_utxo)
  expect Some(borrow_output) =
    list.find(
      outputs,
      fn(output) { output.address == borrow_input.output.address },
    )

  let oracle_lovelace_value = lovelace_of(oracle_ref.output.value)
  let oracle_usd_value =
    quantity_of(oracle_ref.output.value, tusd_policy_id, tusd_asset_name)
  let oracle_lovelace_usd_rate = oracle_lovelace_value / oracle_usd_value

  let borrow_input_lovelace_value = lovelace_of(borrow_input.output.value)
  let borrow_output_usd =
    quantity_of(borrow_output.value, tusd_policy_id, tusd_asset_name)

  expect Some(borrow_input_output) =
    list.find(
      outputs,
      fn(output) { lovelace_of(output.value) == borrow_input_lovelace_value },
    )
  let is_borrow_input_to_collateral_validator =
    borrow_input_output.address.payment_credential == Script(
      collateral_validator_hash,
    )

  let is_tsud_borrowed_valid_in_datum = borrow_output_usd == tusd_borrowed

  and {
    validate_protocol_parameters(
      reference_inputs,
      protocol_parameters_hash,
      borrow_input_lovelace_value,
      borrow_output_usd,
      oracle_lovelace_usd_rate,
      loan_term,
    ),
    is_borrow_input_to_collateral_validator,
    is_tsud_borrowed_valid_in_datum,
  }
}

fn validate_protocol_parameters(
  reference_inputs: List<Input>,
  protocol_parameters_hash: ScriptHash,
  borrow_input_lovelace_value: Int,
  borrow_output_usd: Int,
  oracle_lovelace_usd_rate: Int,
  borrower_provided_loan_term: Int,
) {
  expect Some(protocol_parameters_ref) =
    find_input_by_script_hash(reference_inputs, protocol_parameters_hash)

  expect InlineDatum(protocol_parameters_datum) =
    protocol_parameters_ref.output.datum

  expect ProtocolParametersDatum {
    min_collateral_ratio,
    min_loan_amount,
    loan_term,
    ..
  } = protocol_parameters_datum

  let hundred_percent_lovelace_value =
    calculate_100_percent_borrow_input_value(
      borrow_input_lovelace_value,
      min_collateral_ratio,
    )
  let borrow_lovelace_usd_rate =
    hundred_percent_lovelace_value / borrow_output_usd

  let is_rate_and_mcr_valid =
    borrow_lovelace_usd_rate >= oracle_lovelace_usd_rate

  let is_loan_amount_valid = borrow_output_usd >= min_loan_amount

  let is_loan_term_valid = borrower_provided_loan_term <= loan_term

  and {
    is_rate_and_mcr_valid,
    is_loan_amount_valid,
    is_loan_term_valid,
  }
}

fn validate_burn_borrow_nft(
  inputs: List<Input>,
  outputs: List<Output>,
  mint: Value,
  collateral_validator_hash: ScriptHash,
) {
  expect Some(collateral_input) =
    find_input_by_script_hash(inputs, collateral_validator_hash)

  expect InlineDatum(collateral_input_datum) = collateral_input.output.datum

  expect CollateralDatum {
    tusd_pool_hash,
    tusd_policy_id,
    tusd_asset_name,
    tusd_borrowed,
    collateral_nft_pid,
    ..
  } = collateral_input_datum

  expect [Pair(_, quantity)] =
    mint |> tokens(collateral_nft_pid) |> dict.to_pairs

  let is_collateral_nft_burned = quantity == -1

  let is_borrowed_amount_refunded =
    inputs
      |> list.any(
          fn(input) {
            (
              input.output.value
                |> quantity_of(tusd_policy_id, tusd_asset_name)
            ) == tusd_borrowed
          },
        )

  let is_refund_amount_going_to_right_pool =
    outputs
      |> list.any(
          fn(output) {
            and {
              Script(tusd_pool_hash) == output.address.payment_credential,
              (
                output.value
                  |> quantity_of(tusd_policy_id, tusd_asset_name)
              ) == tusd_borrowed,
            }
          },
        )

  and {
    is_collateral_nft_burned,
    is_borrowed_amount_refunded,
    is_refund_amount_going_to_right_pool,
  }
}
