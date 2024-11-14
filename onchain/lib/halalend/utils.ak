use aiken/collection/list
use aiken/crypto.{VerificationKeyHash}
use cardano/transaction.{Input, OutputReference}

pub fn signed_by(
  signatories: List<VerificationKeyHash>,
  signer: VerificationKeyHash,
) {
  signatories |> list.has(signer)
}

pub fn find_input(inputs: List<Input>, utxo: OutputReference) {
  inputs |> list.find(fn(input) { input.output_reference == utxo })
}
