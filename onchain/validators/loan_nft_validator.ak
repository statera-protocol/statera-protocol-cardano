use aiken/collection/dict
use aiken/collection/list
use aiken/crypto.{ScriptHash}
use cardano/address.{Address, Script}
use cardano/assets.{
  PolicyId, Value, from_asset, from_asset_list, from_lovelace, lovelace_of,
  quantity_of,
}
use cardano/transaction.{
  InlineDatum, Input, NoDatum, Output, OutputReference, Transaction, find_input,
  placeholder,
}
use halalend/constants.{usd_with_lovelace_precision_factor}
use halalend/datums.{CollateralDatum, ProtocolParametersDatum}
use halalend/utils.{
  calculate_by_percentage, find_input_by_hash, find_output_by_hash,
}
use mocktail/virgin_key_hash.{
  mock_policy_id, mock_pub_key_hash, mock_script_hash,
}
use mocktail/virgin_output_reference.{mock_utxo_ref}

pub type Action {
  Mint
  Burn
}

validator loan_nft_validator(
  borrow_utxo: OutputReference,
  collateral_validator_hash: ScriptHash,
  protocol_parameters_hash: ScriptHash,
  oracle_hash: ScriptHash,
) {
  mint(redeemer: Action, policy_id: PolicyId, self: Transaction) {
    let Transaction { inputs, outputs, mint, reference_inputs, .. } = self

    when redeemer is {
      Mint ->
        validate_mint_borrow_nft(
          mint,
          policy_id,
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
  mint: Value,
  policy_id: PolicyId,
  inputs: List<Input>,
  collateral_validator_hash: ScriptHash,
  protocol_parameters_hash: ScriptHash,
  oracle_hash: ScriptHash,
  reference_inputs: List<Input>,
  outputs: List<Output>,
  borrow_utxo: OutputReference,
) {
  expect Some(collateral_output) =
    find_output_by_hash(outputs, collateral_validator_hash)

  expect InlineDatum(collateral_output_datum) = collateral_output.datum

  expect CollateralDatum {
    tusd_policy_id,
    tusd_asset_name,
    tusd_borrowed,
    loan_nft_pid,
    collateral_rate_in_lovelace,
    collateral_asset,
    collateral_amount_in_lovelace,
    ..
  } = collateral_output_datum

  expect [Pair(nft_asset_name, nft_quantity)] =
    mint |> assets.tokens(policy_id) |> dict.to_pairs

  expect [Pair(_, mint_loan_quantity)] =
    mint |> assets.tokens(tusd_policy_id) |> dict.to_pairs
  let is_loan_mint_quantity_valid = mint_loan_quantity == tusd_borrowed

  expect Some(oracle_ref) = find_input_by_hash(reference_inputs, oracle_hash)

  expect Some(borrow_input) = find_input(inputs, borrow_utxo)

  expect Some(borrow_output) =
    list.find(
      outputs,
      fn(output) { output.address == borrow_input.output.address },
    )

  expect Some(collateral_output) =
    list.find(
      outputs,
      fn(output) { lovelace_of(output.value) == collateral_amount_in_lovelace },
    )
  let is_borrow_input_to_collateral_validator =
    collateral_output.address.payment_credential == Script(
      collateral_validator_hash,
    )

  let oracle_lovelace_value = lovelace_of(oracle_ref.output.value)
  let oracle_usd_value =
    quantity_of(oracle_ref.output.value, tusd_policy_id, tusd_asset_name)
  let oracle_lovelace_usd_rate =
    oracle_usd_value * usd_with_lovelace_precision_factor / oracle_lovelace_value

  let borrow_output_usd =
    quantity_of(borrow_output.value, tusd_policy_id, tusd_asset_name)

  let is_tsud_borrowed_valid_in_datum = borrow_output_usd == tusd_borrowed

  let loan_nft_pid_valid_in_datum = loan_nft_pid == policy_id

  let loan_nft_mint = nft_quantity == 1

  let borrower_receives_nft =
    quantity_of(borrow_output.value, policy_id, nft_asset_name) == 1

  and {
    validate_protocol_parameters(
      reference_inputs,
      protocol_parameters_hash,
      collateral_rate_in_lovelace,
      collateral_amount_in_lovelace,
      borrow_output_usd,
      oracle_lovelace_usd_rate,
      collateral_asset,
    )?,
    is_loan_mint_quantity_valid?,
    is_borrow_input_to_collateral_validator?,
    is_tsud_borrowed_valid_in_datum?,
    loan_nft_pid_valid_in_datum?,
    loan_nft_mint?,
    borrower_receives_nft?,
  }
  // is_pool_hash_valid?,
}

fn validate_protocol_parameters(
  reference_inputs: List<Input>,
  protocol_parameters_hash: ScriptHash,
  collateral_rate_in_lovelace: Int,
  collateral_amount_in_lovelace: Int,
  borrow_output_usd: Int,
  oracle_lovelace_usd_rate: Int,
  collateral_asset: ByteArray,
) {
  expect Some(protocol_parameters_ref) =
    find_input_by_hash(reference_inputs, protocol_parameters_hash)

  expect InlineDatum(protocol_parameters_datum) =
    protocol_parameters_ref.output.datum

  expect ProtocolParametersDatum {
    min_collateral_ratio,
    min_loan_amount,
    collateral_assets,
    ..
  } = protocol_parameters_datum

  let hundred_percent_lovelace_value =
    calculate_by_percentage(
      collateral_amount_in_lovelace,
      min_collateral_ratio,
      100,
    )
  let borrow_lovelace_usd_rate =
    borrow_output_usd * usd_with_lovelace_precision_factor / hundred_percent_lovelace_value

  let is_rate_and_mcr_valid =
    borrow_lovelace_usd_rate == oracle_lovelace_usd_rate

  let is_rate_in_datum_valid =
    borrow_lovelace_usd_rate == collateral_rate_in_lovelace

  let is_loan_amount_valid = borrow_output_usd >= min_loan_amount

  let is_collateral_asset = list.has(collateral_assets, collateral_asset)

  and {
    is_rate_and_mcr_valid?,
    is_rate_in_datum_valid?,
    is_loan_amount_valid?,
    is_collateral_asset?,
  }
}

fn validate_burn_borrow_nft(
  inputs: List<Input>,
  outputs: List<Output>,
  mint: Value,
  collateral_validator_hash: ScriptHash,
) {
  expect Some(collateral_input) =
    find_input_by_hash(inputs, collateral_validator_hash)

  expect InlineDatum(collateral_input_datum) = collateral_input.output.datum

  expect CollateralDatum { tusd_policy_id, tusd_borrowed, loan_nft_pid, .. } =
    collateral_input_datum

  expect [Pair(loan_nft_name, quantity)] =
    mint |> assets.tokens(loan_nft_pid) |> dict.to_pairs

  expect Some(loan_nft_refunder_input) =
    inputs
      |> list.find(
          fn(input) {
            ( input.output.value |> quantity_of(loan_nft_pid, loan_nft_name) ) == 1
          },
        )

  let is_loan_nft_burned = quantity == -1

  expect [Pair(_, refund_mint_quantity)] =
    mint |> assets.tokens(tusd_policy_id) |> dict.to_pairs
  let is_refund_amount_burned = refund_mint_quantity == -tusd_borrowed

  let is_collateral_going_back_to_refunder =
    outputs
      |> list.any(
          fn(output) {
            and {
              output.address.payment_credential == loan_nft_refunder_input.output.address.payment_credential,
              output.value == collateral_input.output.value,
            }
          },
        )

  and {
    is_loan_nft_burned?,
    is_refund_amount_burned?,
    is_collateral_going_back_to_refunder?,
  }
}

// Tests
test test_borrow_with_right_values() {
  let borrow_outref = mock_utxo_ref(0, 0)
  let borrow_key_hash = mock_pub_key_hash(0)
  // 15 ADA with 150% MCR @ 1.2$ per ADA so allowed to borrow $12
  let borrow_collateral_value = from_lovelace(15000000)
  let borrow_input =
    Input {
      output_reference: borrow_outref,
      output: Output {
        address: Address {
          payment_credential: Script(borrow_key_hash),
          stake_credential: None,
        },
        value: borrow_collateral_value,
        datum: NoDatum,
        reference_script: None,
      },
    }

  let protocol_parameters_outref = mock_utxo_ref(0, 1)
  let protocol_parameters_script_hash = mock_script_hash(1)
  let protocol_parameters_ref =
    Input {
      output_reference: protocol_parameters_outref,
      output: Output {
        address: Address {
          payment_credential: Script(protocol_parameters_script_hash),
          stake_credential: None,
        },
        value: from_lovelace(2000000),
        datum: InlineDatum(
          ProtocolParametersDatum {
            min_collateral_ratio: 150,
            min_liquidation_threshold: 120,
            min_loan_amount: 10,
            protocol_usage_fee: 2,
            collateral_assets: ["ada", "iUSD", "halalend", "hosky"],
          },
        ),
        reference_script: None,
      },
    }

  let loan_nft_policy_id = mock_policy_id(1)
  let collateral_validator_script_hash = mock_script_hash(2)
  let test_usd_pool_hash = mock_script_hash(3)
  let test_usd_policy_id = mock_policy_id(9)
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
        },
      ),
      reference_script: None,
    }

  let oracle_outref = mock_utxo_ref(0, 2)
  let oracle_script_hash = mock_script_hash(4)
  let oracle_ref =
    Input {
      output_reference: oracle_outref,
      output: Output {
        address: Address {
          payment_credential: Script(oracle_script_hash),
          stake_credential: None,
        },
        // $24 / 20000000 lovelaces == $1.2/lovelace
        value: assets.merge(
          from_lovelace(20000000),
          from_asset(test_usd_policy_id, test_usd_asset_name, 24),
        ),
        datum: NoDatum,
        reference_script: None,
      },
    }

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

  let mint =
    from_asset_list(
      [
        Pair(loan_nft_policy_id, [Pair("BorrowNFT1", 1)]),
        Pair(test_usd_policy_id, [Pair("tUSD", 12)]),
      ],
    )

  let tx =
    Transaction {
      ..placeholder,
      inputs: [borrow_input],
      outputs: [collateral_validator_output, borrow_output],
      reference_inputs: [protocol_parameters_ref, oracle_ref],
      mint: mint,
    }

  loan_nft_validator.mint(
    borrow_outref,
    collateral_validator_script_hash,
    protocol_parameters_script_hash,
    oracle_script_hash,
    Mint,
    loan_nft_policy_id,
    tx,
  )
}

test test_repay_loan_burn_nft_with_right_values() {
  let loan_nft_policy_id = mock_policy_id(0)
  let borrow_outref = mock_utxo_ref(0, 0)
  let protocol_parameters_script_hash = mock_script_hash(1)
  let oracle_script_hash = mock_script_hash(4)

  let collateral_validator_script_hash = mock_script_hash(2)
  let tusd_pool_script_hash = mock_script_hash(3)
  let test_usd_policy_id = mock_policy_id(9)
  let test_usd_asset_name = "tUSD"
  let collateral_amount_in_lovelace = 15000000
  let collateral_input =
    Input {
      output_reference: mock_utxo_ref(0, 1),
      output: Output {
        address: Address {
          payment_credential: Script(collateral_validator_script_hash),
          stake_credential: None,
        },
        value: from_lovelace(collateral_amount_in_lovelace),
        datum: InlineDatum(
          CollateralDatum {
            tusd_pool_hash: tusd_pool_script_hash,
            tusd_policy_id: test_usd_policy_id,
            tusd_asset_name: test_usd_asset_name,
            tusd_borrowed: 12,
            loan_nft_pid: loan_nft_policy_id,
            // $1.2 (per ADA)
            collateral_rate_in_lovelace: 1200000,
            collateral_asset: "ada",
            collateral_amount_in_lovelace,
          },
        ),
        reference_script: None,
      },
    }

  let refunder_outref = mock_utxo_ref(0, 2)
  let refunder_key_hash = mock_pub_key_hash(0)
  let loan_refund_value =
    from_asset(test_usd_policy_id, test_usd_asset_name, 12)
  let refunder_value =
    assets.merge(
      assets.merge(
        // assumed minimum ada value for a utxo
        from_lovelace(2000000),
        from_asset(loan_nft_policy_id, "BorrowNFT1", 1),
      ),
      loan_refund_value,
    )
  let refunder_input =
    Input {
      output_reference: refunder_outref,
      output: Output {
        address: Address {
          payment_credential: Script(refunder_key_hash),
          stake_credential: None,
        },
        value: refunder_value,
        datum: NoDatum,
        reference_script: None,
      },
    }

  // Some inputs of 'tUSD' also comes in to repay the loan but we don't check the inputs
  //   because the main validation is that there is an output of 'tUSD' to the pool
  let pool_output =
    Output {
      address: Address {
        payment_credential: Script(tusd_pool_script_hash),
        stake_credential: None,
      },
      value: assets.merge(
        // assumed minimum ada value for a utxo
        from_lovelace(2000000),
        loan_refund_value,
      ),
      datum: NoDatum,
      reference_script: None,
    }

  let refunder_output =
    Output {
      address: Address {
        payment_credential: Script(refunder_key_hash),
        stake_credential: None,
      },
      value: from_lovelace(collateral_amount_in_lovelace),
      datum: NoDatum,
      reference_script: None,
    }

  let mint =
    assets.merge(
      from_asset(loan_nft_policy_id, "BorrowNFT1", -1),
      from_asset(test_usd_policy_id, "tUSD", -12),
    )

  let tx =
    Transaction {
      ..placeholder,
      inputs: [collateral_input, refunder_input],
      outputs: [pool_output, refunder_output],
      mint: mint,
    }

  loan_nft_validator.mint(
    borrow_outref,
    collateral_validator_script_hash,
    protocol_parameters_script_hash,
    oracle_script_hash,
    Burn,
    loan_nft_policy_id,
    tx,
  )
}
