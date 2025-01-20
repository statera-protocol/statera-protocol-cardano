// use aiken/primitive/bytearray.{to_string}
use aiken/collection/dict
use aiken/collection/list
use aiken/crypto.{ScriptHash}
use cardano/address.{Address, Script, VerificationKey}
use cardano/assets.{
  PolicyId, Value, from_asset, from_asset_list, from_lovelace, lovelace_of,
  quantity_of,
}
use cardano/transaction.{
  InlineDatum, Input, NoDatum, Output, OutputReference, Transaction, find_input,
  placeholder,
}
use halalend/constants.{usd_with_lovelace_precision_factor, identifier_token_name}
use halalend/datums.{
  CollateralDatum, CollateralValidatorDatum, DepositorDatum,
  ProtocolParametersDatum,
}
use halalend/utils.{calculate_by_percentage, find_input_by_hash}
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
  // find collateral output going to collateral validator script and make sure it's datum is of type CollateralDatum
  expect Some(collateral_output) =
    list.find(
      outputs,
      fn(output) {
        and {
          (output.address.payment_credential == Script(
            collateral_validator_hash,
          ))?,
          when output.datum is {
            InlineDatum(output_datum) ->
              if output_datum is CollateralValidatorDatum {
                when output_datum is {
                  CollateralDatum { .. } -> True
                  _ -> False
                }
              } else {
                False
              }
            _ -> False
          },
        }
      },
    )

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

  let is_borrow_ada_amount_valid =
    lovelace_of(collateral_output.value) == collateral_amount_in_lovelace

  expect [Pair(nft_asset_name, nft_quantity)] =
    mint |> assets.tokens(policy_id) |> dict.to_pairs

  expect [Pair(_, mint_loan_quantity)] =
    mint |> assets.tokens(tusd_policy_id) |> dict.to_pairs
  let is_loan_mint_quantity_valid = mint_loan_quantity == tusd_borrowed

  expect Some(oracle_ref) =
    reference_inputs
      |> list.find(
          fn(ref_i) {
            and {
              (Script(oracle_hash) == ref_i.output.address.payment_credential)?,
              (quantity_of(ref_i.output.value, tusd_policy_id, tusd_asset_name) > 0)?,
            }
          },
        )

  expect Some(borrow_input) = find_input(inputs, borrow_utxo)
  expect
    borrow_input.output.address.payment_credential == Script(
      collateral_validator_hash,
    )
  expect InlineDatum(borrow_input_datum) = borrow_input.output.datum
  expect DepositorDatum { depositor_vkh } = borrow_input_datum

  expect Some(change_output) =
    list.find(
      outputs,
      fn(output) {
          when output.datum is {
            InlineDatum(change_output_datum) ->
              if change_output_datum is DepositorDatum {
                    depositor_vkh: change_output_datum_depositor_vkh,
                  }: CollateralValidatorDatum {
                and {
                    output.address.payment_credential == Script(
                      collateral_validator_hash,
                    ),
                    depositor_vkh == change_output_datum_depositor_vkh,
                  }
                } else {
                False
              }
            _ -> False
          }
      },
    )
  // Check that the change of borrow input goes back as deposit to the collateral validator
  let is_borrow_input_change_returned =
    lovelace_of(borrow_input.output.value) - collateral_amount_in_lovelace == lovelace_of(
      change_output.value,
    )

  // find a borrow output that has the loan NFT is going to
  expect Some(borrow_output) =
    outputs
      |> list.find(
          fn(output) {
            and {
              output.address.payment_credential == VerificationKey(
                depositor_vkh,
              ),
              quantity_of(output.value, policy_id, nft_asset_name) == 1,
            }
          },
        )

  let oracle_lovelace_value = lovelace_of(oracle_ref.output.value)
  let oracle_usd_value =
    quantity_of(oracle_ref.output.value, tusd_policy_id, tusd_asset_name)
  let oracle_lovelace_usd_rate = oracle_lovelace_value / oracle_usd_value
  let oracle_usd_lovelace_rate =
    oracle_usd_value * usd_with_lovelace_precision_factor / oracle_lovelace_value

  let borrow_output_usd =
    quantity_of(borrow_output.value, tusd_policy_id, tusd_asset_name)

  let is_tsud_borrowed_valid_in_datum = borrow_output_usd == tusd_borrowed

  let loan_nft_pid_valid_in_datum = loan_nft_pid == policy_id

  let loan_nft_mint = nft_quantity == 1

  and {
    validate_protocol_parameters(
      reference_inputs,
      protocol_parameters_hash,
      collateral_rate_in_lovelace,
      collateral_amount_in_lovelace,
      borrow_output_usd,
      oracle_lovelace_usd_rate,
      oracle_usd_lovelace_rate,
      collateral_asset,
    )?,
    is_borrow_ada_amount_valid?,
    is_borrow_input_change_returned?,
    is_loan_mint_quantity_valid?,
    is_tsud_borrowed_valid_in_datum?,
    loan_nft_pid_valid_in_datum?,
    loan_nft_mint?,
  }
}

fn validate_protocol_parameters(
  reference_inputs: List<Input>,
  protocol_parameters_hash: ScriptHash,
  collateral_rate_in_lovelace: Int,
  collateral_amount_in_lovelace: Int,
  borrow_output_usd: Int,
  oracle_lovelace_usd_rate: Int,
  oracle_usd_lovelace_rate: Int,
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
  let expected_borrow_lovelace = borrow_output_usd * oracle_lovelace_usd_rate

  let is_rate_and_mcr_valid =
    hundred_percent_lovelace_value >= expected_borrow_lovelace

  let is_rate_in_datum_valid =
    oracle_usd_lovelace_rate == collateral_rate_in_lovelace

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
    list.find(
      inputs,
      fn(input) {
        and {
          (input.output.address.payment_credential == Script(
            collateral_validator_hash,
          ))?,
          when input.output.datum is {
            InlineDatum(input_datum) ->
              if input_datum is CollateralDatum { .. }: CollateralValidatorDatum {
                True
              } else {
                False
              }
            _ -> False
          },
        }
      },
    )

  expect InlineDatum(collateral_input_datum) = collateral_input.output.datum

  expect CollateralDatum { tusd_policy_id, tusd_borrowed, loan_nft_pid, collateral_amount_in_lovelace, .. } =
    collateral_input_datum

  expect [Pair(loan_nft_name, quantity)] =
    mint |> assets.tokens(loan_nft_pid) |> dict.to_pairs

  // Find input user balance
  expect Some(user_balance_input) =
    list.find(
      inputs,
      fn(input) {
        when input.output.datum is {
          InlineDatum(change_input_datum) ->
            if change_input_datum is DepositorDatum { .. }: CollateralValidatorDatum {
              (input.output.address.payment_credential == Script(collateral_validator_hash))?
            } else {
              False
            }
          _ -> False
        }
      },
    )
  expect InlineDatum(user_balance_input_datum) = user_balance_input.output.datum
  expect DepositorDatum { depositor_vkh } = user_balance_input_datum

  // Find the loan NFT; make sure the loan NFT provider is the one whose whose balance will be update
  expect Some(_loan_nft_refunder_input) =
    inputs
      |> list.find(
          fn(input) {
            and {
              (input.output.address.payment_credential == VerificationKey(depositor_vkh))?,
              (( input.output.value |> quantity_of(loan_nft_pid, loan_nft_name) ) == 1)?,
            }
          },
        )

  let is_loan_nft_burned = quantity == -1

  // Find output user balance with same depositor_vkh
  expect Some(user_balance_output) =
    list.find(
      outputs,
      fn(output) {
        when output.datum is {
          InlineDatum(output_datum) ->
            if output_datum is DepositorDatum { depositor_vkh: output_depositor_vkh }: CollateralValidatorDatum {
              and {
                (output.address.payment_credential == Script(collateral_validator_hash))?,
                (depositor_vkh == output_depositor_vkh)?,
              }
            } else {
              False
            }
          _ -> False
        }
      },
    )

  let is_collateral_going_back_to_refunder = (lovelace_of(user_balance_input.output.value) + collateral_amount_in_lovelace) == lovelace_of(user_balance_output.value)

  expect [Pair(_, refund_mint_quantity)] =
    mint |> assets.tokens(tusd_policy_id) |> dict.to_pairs
  let is_refund_amount_burned = refund_mint_quantity == -tusd_borrowed

  and {
    is_loan_nft_burned?,
    is_refund_amount_burned?,
    is_collateral_going_back_to_refunder?,
  }
}

// Tests
test test_borrow_with_right_values() {
  let collateral_validator_script_hash = mock_script_hash(2)
  let borrow_lovelace_amount = 15000000
  let borrow_outref = mock_utxo_ref(0, 0)
  let borrow_key_hash = mock_pub_key_hash(0)
  // 15 ADA with 150% MCR @ 1.2$ per ADA so allowed to borrow $12
  let borrow_collateral_lovelace = 20000000
  let borrow_input =
    Input {
      output_reference: borrow_outref,
      output: Output {
        address: Address {
          payment_credential: Script(collateral_validator_script_hash),
          stake_credential: None,
        },
        value: from_lovelace(borrow_collateral_lovelace),
        datum: InlineDatum(DepositorDatum { depositor_vkh: borrow_key_hash }),
        reference_script: None,
      },
    }

  let change_output =
    Output {
      address: Address {
        payment_credential: Script(collateral_validator_script_hash),
        stake_credential: None,
      },
      value: from_lovelace(borrow_collateral_lovelace - borrow_lovelace_amount),
      datum: InlineDatum(DepositorDatum { depositor_vkh: borrow_key_hash }),
      reference_script: None,
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
  let test_usd_pool_hash = mock_script_hash(3)
  let test_usd_policy_id = mock_policy_id(9)
  let test_usd_asset_name = "tUSD"
  let collateral_amount_in_lovelace = borrow_lovelace_amount
  let loan_nft_name = "BorrowNFT1"
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
          loan_nft_asset_name: loan_nft_name,
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
        payment_credential: VerificationKey(borrow_key_hash),
        stake_credential: None,
      },
      // Borrowers should be given $12 USD as he provided an over-collaterized asset
      // of ADA in 15 ADA (normal - 10 ADA) @ $1.2 USD per ADA rate
      value: assets.merge(
        from_asset(test_usd_policy_id, test_usd_asset_name, 12),
        from_asset(loan_nft_policy_id, loan_nft_name, 1),
      ),
      datum: NoDatum,
      reference_script: None,
    }

  let mint =
    from_asset_list(
      [
        Pair(loan_nft_policy_id, [Pair(loan_nft_name, 1)]),
        Pair(test_usd_policy_id, [Pair("tUSD", 12)]),
      ],
    )

  let tx =
    Transaction {
      ..placeholder,
      inputs: [borrow_input],
      outputs: [collateral_validator_output, borrow_output, change_output],
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
  let loan_nft_name = "BorrowNFT1"
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
            loan_nft_asset_name: loan_nft_name,
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
        from_asset(loan_nft_policy_id, loan_nft_name, 1),
      ),
      loan_refund_value,
    )
  let refunder_input =
    Input {
      output_reference: refunder_outref,
      output: Output {
        address: Address {
          payment_credential: VerificationKey(refunder_key_hash),
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

  let user_balance_datum = DepositorDatum { depositor_vkh: refunder_key_hash }
  let user_balance_input =
    Input {
      output_reference: mock_utxo_ref(0, 11),
      output: Output {
        address: Address {
          payment_credential: Script(collateral_validator_script_hash),
          stake_credential: None,
        },
        value: from_lovelace(4000000),
        datum: InlineDatum(user_balance_datum),
        reference_script: None,
      },
    }
  let user_balance_output =
    Output {
      address: Address {
        payment_credential: Script(collateral_validator_script_hash),
        stake_credential: None,
      },
      value: assets.merge(
        from_lovelace(4000000 + collateral_amount_in_lovelace),
        from_asset(collateral_validator_script_hash, identifier_token_name, 1),
      ),
      datum: InlineDatum(user_balance_datum),
      reference_script: None,
    }

  let mint =
    assets.merge(
      from_asset(loan_nft_policy_id, loan_nft_name, -1),
      from_asset(test_usd_policy_id, "tUSD", -12),
    )

  let tx =
    Transaction {
      ..placeholder,
      inputs: [collateral_input, refunder_input, user_balance_input],
      outputs: [pool_output, user_balance_output],
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
