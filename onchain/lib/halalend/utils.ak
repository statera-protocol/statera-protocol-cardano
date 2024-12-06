use aiken/collection/list
use aiken/crypto.{ScriptHash, VerificationKeyHash}
use aiken/interval.{Finite}
use cardano/address.{Script}
use cardano/transaction.{Input, OutputReference, ValidityRange}

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
pub fn find_input_by_script_hash(inputs: List<Input>, script_hash: ScriptHash) {
  list.find(
    inputs,
    fn(input) { input.output.address.payment_credential == Script(script_hash) },
  )
}
