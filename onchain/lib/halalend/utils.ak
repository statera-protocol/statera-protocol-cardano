use aiken/collection/list
use aiken/crypto.{ScriptHash, VerificationKeyHash}
use aiken/interval.{Finite, PositiveInfinity}
use cardano/address.{Script, VerificationKey}
use cardano/transaction.{Input, Output, OutputReference, ValidityRange}

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

// /// Filters outputs by hash
// pub fn filter_outputs_by_hash(outputs: List<Output>, script_hash: ScriptHash) {
//   list.filter(
//     outputs,
//     fn(output) { output.address.payment_credential == Script(script_hash) },
//   )
// }

/// Finds an output by it's script hash
pub fn find_output_by_hash(outputs: List<Output>, script_hash: ScriptHash) {
  list.find(
    outputs,
    fn(output) { output.address.payment_credential == Script(script_hash) },
  )
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
