use aiken/collection/list
use aiken/crypto.{ScriptHash, VerificationKeyHash}
use aiken/interval.{Finite, PositiveInfinity}
use aiken/primitive/bytearray
use cardano/address.{Script, VerificationKey}
use cardano/assets.{AssetName, PolicyId, quantity_of}
use cardano/transaction.{
  InlineDatum, Input, Output, OutputReference, ValidityRange,
}
use statera/datums.{OracleDatum}
use statera/types.{AssetRate}

// validate that the transaction is signed by 'signer'
pub fn signed_by(
  signatories: List<VerificationKeyHash>,
  signer: VerificationKeyHash,
) {
  signatories |> list.has(signer)
}

// returns an input corresponding to a utxo
pub fn find_input(inputs: List<Input>, utxo: OutputReference) {
  inputs |> list.find(fn(input) { input.output_reference == utxo })
}

// confirms that loan term has ended
pub fn is_loan_term_end(range: ValidityRange, loan_term: Int) {
  when range.lower_bound.bound_type is {
    Finite(time_now) -> loan_term <= time_now
    _ -> False
  }
}

/// Calculates the value of an asset by percentage
pub fn calculate_by_percentage(
  given_value: Int,
  given_percentage: Int,
  percentage_wanted: Int,
) {
  given_value / given_percentage * percentage_wanted
}

/// Finds an input by it's script hash
pub fn find_input_by_hash(inputs: List<Input>, script_hash: ScriptHash) {
  list.find(
    inputs,
    fn(input) { input.output.address.payment_credential == Script(script_hash) },
  )
}

/// Finds output by verification key hash
pub fn find_output_by_vkh(outputs: List<Output>, vkh: VerificationKeyHash) {
  list.find(
    outputs,
    fn(output) { output.address.payment_credential == VerificationKey(vkh) },
  )
}

/// Filters inputs by verification key hash
pub fn filter_inputs_by_vkh(inputs: List<Input>, vkh: VerificationKeyHash) {
  list.filter(
    inputs,
    fn(input) {
      input.output.address.payment_credential == VerificationKey(vkh)
    },
  )
}

/// Filters outputs by vkh
pub fn filter_outputs_by_vkh(outputs: List<Output>, vkh: VerificationKeyHash) {
  list.filter(
    outputs,
    fn(output) { output.address.payment_credential == VerificationKey(vkh) },
  )
}

/// Finds an output by it's script hash
pub fn find_output_by_hash(outputs: List<Output>, script_hash: ScriptHash) {
  list.find(
    outputs,
    fn(output) { output.address.payment_credential == Script(script_hash) },
  )
}

/// Returns the amount of aggregated inputs and outputs quantity of a particular token for specific user
pub fn get_user_asset_amt_in_out(
  inputs: List<Input>,
  outputs: List<Output>,
  user_vkh: VerificationKeyHash,
  ast_policy_id: PolicyId,
  ast_asset_name: AssetName,
) {
  // get all inputs coming from user's wallet
  let user_wallet_inputs = filter_inputs_by_vkh(inputs, user_vkh)
  // get total asset input from user's wallet
  let user_wallet_total_ast_in =
    user_wallet_inputs
      |> list.foldl(
          0,
          fn(input, asset_total) {
            let asset_amount =
              quantity_of(input.output.value, ast_policy_id, ast_asset_name)
            asset_amount + asset_total
          },
        )

  // find outputs going back to the user's wallet
  let user_wallet_outputs = filter_outputs_by_vkh(outputs, user_vkh)
  // get total asset output to user's wallet
  let user_wallet_total_ast_out =
    user_wallet_outputs
      |> list.foldl(
          0,
          fn(output, asset_total) {
            let asset_amount =
              quantity_of(output.value, ast_policy_id, ast_asset_name)
            asset_amount + asset_total
          },
        )

  (user_wallet_total_ast_in, user_wallet_total_ast_out)
}

/// Get the borrower's loan term in milli seconds
pub fn get_borrower_loan_term(loan_term: Int, range: ValidityRange) {
  when range.lower_bound.bound_type is {
    Finite(time_now) -> {
      trace @"time_now": time_now
      loan_term - time_now
    }
    PositiveInfinity -> {
      trace @"lower bound is positive infinity"
      1_000_000_000_000_000_000_000_000_000_000_000_000
    }
    _ -> {
      trace @"borrower provided loan term is too high"
      1_000_000_000_000_000_000_000_000_000_000_000_000
    }
  }
}

/// Finds a reference input of the unified control validator
pub fn find_ucv_ref_input(
  ref_inputs: List<Input>,
  unified_control_validator_hash: ScriptHash,
  the_asset_name: AssetName,
) {
  ref_inputs
    |> list.find(
        fn(ref_i) {
          and {
            (Script(unified_control_validator_hash) == ref_i.output.address.payment_credential)?,
            (quantity_of(
              ref_i.output.value,
              unified_control_validator_hash,
              the_asset_name,
            ) == 1)?,
          }
        },
      )
}

/// Finds an oracle rate from the oracle ref datum
pub fn find_oracle_rate(
  oracle_ref: Input,
  collateral_asset_pid: PolicyId,
  collateral_asset_an: AssetName,
) {
  expect InlineDatum(oracle_ref_datum) = oracle_ref.output.datum
  // make sure the oracle reference input datum contains a list of asset rates
  expect OracleDatum { oracle_rates } = oracle_ref_datum

  list.find(
    oracle_rates,
    fn(a_oracle) {
      let a_collateral_asset_unit =
        bytearray.concat(collateral_asset_pid, collateral_asset_an)
      let AssetRate { unit: a_unit, .. } = a_oracle

      trace @"a_unit": a_unit
      trace @"a_collateral_asset_unit": a_collateral_asset_unit

      (a_unit == a_collateral_asset_unit)?
    },
  )
}
