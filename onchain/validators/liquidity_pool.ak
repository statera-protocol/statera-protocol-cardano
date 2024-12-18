use aiken/collection/list
use aiken/crypto.{ScriptHash}
use cardano/address.{Address, Script}
use cardano/assets.{AssetName, PolicyId, from_asset, from_lovelace, quantity_of}
use cardano/transaction.{
  InlineDatum, Input, NoDatum, Output, OutputReference, Transaction, find_input,
  placeholder,
}
use halalend/datums.{CollateralDatum}
use halalend/utils.{
  filter_inputs_by_hash, filter_outputs_by_hash, find_output_by_hash,
}
use mocktail/virgin_key_hash.{
  mock_policy_id, mock_pub_key_hash, mock_script_hash,
}
use mocktail/virgin_output_reference.{mock_utxo_ref}

validator liquidity_pool(collateral_validator_hash: ScriptHash) {
  spend(_d: Option<Data>, _r: Data, o_ref: OutputReference, self: Transaction) {
    let Transaction { inputs, outputs, .. } = self

    expect Some(own_input) = find_input(inputs, o_ref)
    expect Script(liquidity_pool_hash) =
      own_input.output.address.payment_credential

    expect Some(collateral_output) =
      find_output_by_hash(outputs, collateral_validator_hash)

    expect InlineDatum(collateral_output_datum) = collateral_output.datum

    expect CollateralDatum {
      tusd_pool_hash,
      tusd_policy_id,
      tusd_asset_name,
      tusd_borrowed,
      ..
    } = collateral_output_datum

    let validate_pool_hash = tusd_pool_hash == liquidity_pool_hash

    and {
      validate_pool_hash?,
      output_tusd_must_equal_input_minus_borrowed(
        liquidity_pool_hash,
        inputs,
        outputs,
        tusd_policy_id,
        tusd_asset_name,
        tusd_borrowed,
      )?,
    }
  }

  else(_) {
    fail
  }
}

fn output_tusd_must_equal_input_minus_borrowed(
  liquidity_pool_hash: ScriptHash,
  inputs: List<Input>,
  outputs: List<Output>,
  tusd_policy_id: PolicyId,
  tusd_asset_name: AssetName,
  tusd_borrowed: Int,
) {
  let inputs_from_pool = filter_inputs_by_hash(inputs, liquidity_pool_hash)

  let tusd_total_in_inputs_from_pool =
    inputs_from_pool
      |> list.foldl(
          0,
          fn(input, tusd_total) {
            let tusd_amount =
              input.output.value |> quantity_of(tusd_policy_id, tusd_asset_name)
            tusd_amount + tusd_total
          },
        )

  let outputs_from_pool = filter_outputs_by_hash(outputs, liquidity_pool_hash)

  let tusd_total_in_outputs_to_pool =
    outputs_from_pool
      |> list.foldl(
          0,
          fn(output, tusd_total) {
            let tusd_amount =
              output.value |> quantity_of(tusd_policy_id, tusd_asset_name)
            tusd_amount + tusd_total
          },
        )

  (tusd_total_in_inputs_from_pool - tusd_borrowed == tusd_total_in_outputs_to_pool)?
}

// Tests
test spend_from_liquidity_pool_when_borrowing() {
  let liquidity_pool_oref = mock_utxo_ref(0, 0)

  let loan_nft_policy_id = mock_policy_id(1)
  let collateral_validator_script_hash = mock_script_hash(2)
  let test_usd_pool_hash = mock_script_hash(3)
  let test_usd_policy_id = mock_policy_id(0)
  let test_usd_asset_name = "tUSD"
  let collateral_amount_in_lovelace = 15000000
  let collateral_validator_output =
    Output {
      address: Address {
        payment_credential: Script(collateral_validator_script_hash),
        stake_credential: None,
      },
      value: from_lovelace(collateral_amount_in_lovelace),
      datum: InlineDatum(
        CollateralDatum {
          tusd_pool_hash: test_usd_pool_hash,
          tusd_policy_id: test_usd_policy_id,
          tusd_asset_name: test_usd_asset_name,
          tusd_borrowed: 12,
          loan_nft_pid: loan_nft_policy_id,
          // $1.2 (per ADA)
          collateral_rate_in_lovelace: 1200000,
          collateral_asset: "ada",
          collateral_amount_in_lovelace,
          loan_term: 10000,
        },
      ),
      reference_script: None,
    }

  let borrow_key_hash = mock_pub_key_hash(0)
  let borrow_output =
    Output {
      address: Address {
        payment_credential: Script(borrow_key_hash),
        stake_credential: None,
      },
      // Borrowers should be given $12 USD as he provided an over-collaterized asset
      // of ADA in 15 ADA (normal - 10 ADA) @ $1.2 USD per ADA rate
      value: assets.merge(
        from_asset(test_usd_policy_id, test_usd_asset_name, 12),
        from_asset(loan_nft_policy_id, "BorrowNFT1", 1),
      ),
      datum: NoDatum,
      reference_script: None,
    }

  let liquidity_input =
    Input {
      output_reference: liquidity_pool_oref,
      output: Output {
        address: Address {
          payment_credential: Script(test_usd_pool_hash),
          stake_credential: None,
        },
        value: from_asset(test_usd_policy_id, test_usd_asset_name, 10),
        datum: NoDatum,
        reference_script: None,
      },
    }

  let liquidity_input2 =
    Input {
      output_reference: liquidity_pool_oref,
      output: Output {
        address: Address {
          payment_credential: Script(test_usd_pool_hash),
          stake_credential: None,
        },
        value: from_asset(test_usd_policy_id, test_usd_asset_name, 25),
        datum: NoDatum,
        reference_script: None,
      },
    }
  
  let liquidity_output =
    Output {
      address: Address {
        payment_credential: Script(test_usd_pool_hash),
        stake_credential: None,
      },
      value: from_asset(test_usd_policy_id, test_usd_asset_name, 23),
      datum: NoDatum,
      reference_script: None,
    }

  let tx =
    Transaction {
      ..placeholder,
      inputs: [liquidity_input, liquidity_input2],
      outputs: [collateral_validator_output, borrow_output, liquidity_output],
    }

  liquidity_pool.spend(
    collateral_validator_script_hash,
    None,
    "",
    liquidity_pool_oref,
    tx,
  )
}
