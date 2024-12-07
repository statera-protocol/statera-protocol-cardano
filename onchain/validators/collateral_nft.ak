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
use halalend/datums.{CollateralDatum, ProtocolParametersDatum}
use halalend/utils.{calculate_by_percentage, find_input_by_script_hash}
use mocktail/virgin_key_hash.{mock_policy_id, mock_script_hash}
use mocktail/virgin_output_reference.{mock_utxo_ref}

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
    outputs
      |> list.find(
          fn(output) {
            output.address.payment_credential == Script(
              collateral_validator_hash,
            )
          },
        )

  expect InlineDatum(collateral_output_datum) = collateral_output.datum

  expect CollateralDatum {
    tusd_policy_id,
    tusd_asset_name,
    tusd_borrowed,
    collateral_nft_pid,
    collateral_asset,
    loan_term,
    ..
  } = collateral_output_datum

  expect [Pair(_, quantity)] = mint |> assets.tokens(policy_id) |> dict.to_pairs

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

  let is_collateral_nft_pid_valid_in_datum = collateral_nft_pid == policy_id

  let is_collateral_nft_mint = quantity == 1

  and {
    validate_protocol_parameters(
      reference_inputs,
      protocol_parameters_hash,
      borrow_input_lovelace_value,
      borrow_output_usd,
      oracle_lovelace_usd_rate,
      collateral_asset,
      loan_term,
    )?,
    is_borrow_input_to_collateral_validator?,
    is_tsud_borrowed_valid_in_datum?,
    is_collateral_nft_pid_valid_in_datum?,
    is_collateral_nft_mint?,
  }
}

fn validate_protocol_parameters(
  reference_inputs: List<Input>,
  protocol_parameters_hash: ScriptHash,
  borrow_input_lovelace_value: Int,
  borrow_output_usd: Int,
  oracle_lovelace_usd_rate: Int,
  collateral_asset: ByteArray,
  borrower_provided_loan_term: Int,
) {
  expect Some(protocol_parameters_ref) =
    find_input_by_script_hash(reference_inputs, protocol_parameters_hash)

  expect InlineDatum(protocol_parameters_datum) =
    protocol_parameters_ref.output.datum

  expect ProtocolParametersDatum {
    min_collateral_ratio,
    min_loan_amount,
    collateral_assets,
    loan_term,
    ..
  } = protocol_parameters_datum

  let hundred_percent_lovelace_value =
    calculate_by_percentage(
      borrow_input_lovelace_value,
      min_collateral_ratio,
      100,
    )
  let borrow_lovelace_usd_rate =
    hundred_percent_lovelace_value / borrow_output_usd

  let is_rate_and_mcr_valid =
    borrow_lovelace_usd_rate >= oracle_lovelace_usd_rate

  let is_loan_amount_valid = borrow_output_usd >= min_loan_amount

  let is_loan_term_valid = borrower_provided_loan_term <= loan_term

  let is_collateral_asset = list.has(collateral_assets, collateral_asset)

  and {
    is_rate_and_mcr_valid?,
    is_loan_amount_valid?,
    is_loan_term_valid?,
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
    mint |> assets.tokens(collateral_nft_pid) |> dict.to_pairs

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

// Tests
test test_borrow() {
  let borrow_outref = mock_utxo_ref(0, 0)
  let borrow_script_hash = mock_script_hash(0)
  // 15 ADA with 150% MCR @ 1.2$ per ADA so allowed to borrow $12
  let borrow_collateral_value = from_lovelace(15000000)
  let borrow_input =
    Input {
      output_reference: borrow_outref,
      output: Output {
        address: Address {
          payment_credential: Script(borrow_script_hash),
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
            loan_term: 12000,
          },
        ),
        reference_script: None,
      },
    }

  let collateral_nft_policy_id = mock_policy_id(1)
  let collateral_validator_script_hash = mock_script_hash(2)
  let test_usd_policy_id = mock_policy_id(0)
  let test_usd_asset_name = "tUSD"
  let collateral_validator_output =
    Output {
      address: Address {
        payment_credential: Script(collateral_validator_script_hash),
        stake_credential: None,
      },
      value: borrow_collateral_value,
      datum: InlineDatum(
        CollateralDatum {
          tusd_pool_hash: mock_script_hash(3),
          tusd_policy_id: test_usd_policy_id,
          tusd_asset_name: test_usd_asset_name,
          tusd_borrowed: 12,
          collateral_nft_pid: collateral_nft_policy_id,
          // $1.2 (per ADA)
          collateral_rate_in_lovelace: 1200000,
          collateral_asset: "ada",
          loan_term: 10000,
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
        payment_credential: Script(borrow_script_hash),
        stake_credential: None,
      },
      // Borrowers should be given $12 USD as he provided an over-collaterized asset
      // of ADA in 15 ADA (normal - 10 ADA) @ $1.2 USD per ADA rate
      value: from_asset(test_usd_policy_id, test_usd_asset_name, 12),
      datum: NoDatum,
      reference_script: None,
    }

  let mint =
    from_asset_list([Pair(collateral_nft_policy_id, [Pair("BorrowNFT1", 1)])])
  let tx =
    Transaction {
      ..placeholder,
      inputs: [borrow_input],
      outputs: [collateral_validator_output, borrow_output],
      reference_inputs: [protocol_parameters_ref, oracle_ref],
      mint: mint,
    }

  collateral_nft.mint(
    borrow_outref,
    collateral_validator_script_hash,
    protocol_parameters_script_hash,
    oracle_script_hash,
    Mint,
    collateral_nft_policy_id,
    tx,
  )
}
