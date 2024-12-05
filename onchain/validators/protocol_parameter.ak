use aiken/crypto.{VerificationKeyHash}
use cardano/address.{Address, Script}
use cardano/assets.{zero}
use cardano/transaction.{
  InlineDatum, Input, Output, OutputReference, Transaction, placeholder,
}
use halalend/datums.{ProtocolParametersDatum}
use halalend/utils.{find_input, signed_by}
use mocktail/virgin_key_hash.{mock_pub_key_hash}
use mocktail/virgin_output_reference.{mock_utxo_ref}

validator protocol_parameter(admin: VerificationKeyHash) {
  spend(
    datum: Option<ProtocolParametersDatum>,
    _r: Data,
    utxo: OutputReference,
    self: Transaction,
  ) {
    // expect some datum
    expect Some(_datum) = datum

    // expect an input in the transaction which is the same as the utxo to be spent
    expect Some(_input) = find_input(self.inputs, utxo)

    // expect the admin to be the signer of the transaction
    signed_by(self.extra_signatories, admin)
  }

  else(_) {
    fail
  }
}

// Test for spending the protocol parameter utxo
test test_spend_protocol_parameter_validator_utxo() {
  let adminvkh = mock_pub_key_hash(0)

  // NOTE!: 'min_collateral_ratio' is in percentage
  let datum =
    ProtocolParametersDatum {
      min_collateral_ratio: 150,
      min_loan_amount: 100,
      protocol_usage_fee: 5,
      collateral_assets: ["ada", "iUSD", "halalend", "hosky"],
      loan_term: 14 * 24 * 60 * 60 * 1000,
    }
  // 14 days in milliseconds
  let redeemer = ""
  let utxo = mock_utxo_ref(0, 0)
  let tx =
    Transaction {
      ..placeholder,
      extra_signatories: [adminvkh],
      inputs: [
        Input {
          output_reference: mock_utxo_ref(0, 0),
          output: Output {
            address: Address {
              payment_credential: Script(mock_pub_key_hash(0)),
              stake_credential: None,
            },
            value: zero,
            datum: InlineDatum(datum),
            reference_script: None,
          },
        },
      ],
    }

  protocol_parameter.spend(adminvkh, Some(datum), redeemer, utxo, tx)
}
