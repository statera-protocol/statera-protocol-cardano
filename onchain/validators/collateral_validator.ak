use aiken/collection/dict
use aiken/collection/list
use aiken/crypto.{ScriptHash, VerificationKeyHash}
use cardano/address.{Address, Script, VerificationKey}
use cardano/assets.{
  AssetName, PolicyId, Value, from_asset, from_asset_list, from_lovelace,
  lovelace_of, quantity_of,
}
use cardano/transaction.{
  InlineDatum, Input, NoDatum, Output, OutputReference, Transaction, find_input,
  placeholder,
}
use halalend/constants.{
  identifier_token_name, receipt_token_name, usd_with_lovelace_precision_factor,
}
use halalend/datums.{
  CollateralDatum, CollateralValidatorDatum, DepositorDatum,
  ProtocolParametersDatum,
}
use halalend/utils.{
  calculate_by_percentage, filter_inputs_by_vkh, find_input_by_hash,
  find_output_by_hash, find_output_by_vkh, signed_by,
}
use mocktail/virgin_key_hash.{
  mock_policy_id, mock_pub_key_hash, mock_script_hash,
}
use mocktail/virgin_output_reference.{mock_utxo_ref}

pub type Action {
  Refund
  Liquidate
  WithdrawDeposit
  IncreaseDeposit
  PartialWithdrawal
  IncreaseCollateral
}

validator collateral_validator(
  protocol_parameters_hash: ScriptHash,
  oracle_hash: ScriptHash,
  liquidated_funds_collector_hash: ScriptHash,
) {
  spend(
    datum: Option<CollateralValidatorDatum>,
    redeemer: Action,
    o_ref: OutputReference,
    self: Transaction,
  ) {
    let Transaction {
      inputs,
      outputs,
      mint,
      reference_inputs,
      extra_signatories,
      ..
    } = self

    expect Some(own_input) = find_input(inputs, o_ref)

    when datum is {
      Some(CollateralDatum { .. }) ->
        handle_collateral(
          protocol_parameters_hash,
          oracle_hash,
          liquidated_funds_collector_hash,
          datum,
          redeemer,
          mint,
          outputs,
          reference_inputs,
          own_input,
          inputs,
        )
      Some(DepositorDatum { .. }) ->
        handle_withdraw_and_increase_deposit(
          datum,
          redeemer,
          extra_signatories,
          own_input,
          outputs,
        )
      _ -> False
    }
  }

  mint(_redeemer: Data, policy_id: PolicyId, self: Transaction) {
    let Transaction { inputs, outputs, mint, .. } = self

    expect Some(deposit_output) = find_output_by_hash(outputs, policy_id)

    expect InlineDatum(deposit_output_datum) = deposit_output.datum
    expect DepositorDatum { depositor_vkh } = deposit_output_datum

    // Note: The asset names are gotten in alphabetical order...
    expect [
      Pair(identifier_name, identifier_quantity),
      Pair(receipt_name, receipt_quantity),
    ] =
      mint
        |> assets.tokens(policy_id)
        |> dict.to_pairs

    expect Some(output_to_depositor) =
      find_output_by_vkh(outputs, depositor_vkh)

    let depositor_inputs = filter_inputs_by_vkh(inputs, depositor_vkh)
    let depositor_inputs_total_ada =
      depositor_inputs
        |> list.foldl(
            0,
            fn(input, ada_total) {
              let ada_amount = lovelace_of(input.output.value)
              ada_amount + ada_total
            },
          )

    let is_mint_valid = and {
        (receipt_name == receipt_token_name)?,
        (receipt_quantity == 1)?,
        (identifier_name == identifier_token_name)?,
        (identifier_quantity == 1)?,
      }
    let is_receipt_to_depositor =
      quantity_of(output_to_depositor.value, policy_id, receipt_name) == 1
    let is_identifier_to_own_script =
      quantity_of(deposit_output.value, policy_id, identifier_name) == 1
    let is_deposit_ada_amount_valid =
      depositor_inputs_total_ada >= lovelace_of(deposit_output.value)

    and {
      is_mint_valid?,
      is_receipt_to_depositor?,
      is_identifier_to_own_script?,
      is_deposit_ada_amount_valid?,
    }
  }

  else(_) {
    fail
  }
}

fn handle_collateral(
  protocol_parameters_hash: ScriptHash,
  oracle_hash: ScriptHash,
  liquidated_funds_collector_hash: ScriptHash,
  datum: Option<CollateralValidatorDatum>,
  redeemer: Action,
  mint: Value,
  outputs: List<Output>,
  reference_inputs: List<Input>,
  own_input: Input,
  inputs: List<Input>,
) {
  expect Some(CollateralDatum {
    tusd_policy_id,
    tusd_asset_name,
    loan_nft_pid,
    collateral_rate_in_lovelace,
    ..
  }) = datum

  when redeemer is {
    Refund -> {
      expect [Pair(_, quantity)] =
        mint |> assets.tokens(loan_nft_pid) |> dict.to_pairs

      (quantity == -1)?
    }

    Liquidate -> and {
        is_liquidation_threshold_reached(
          protocol_parameters_hash,
          oracle_hash,
          collateral_rate_in_lovelace,
          reference_inputs,
          tusd_policy_id,
          tusd_asset_name,
        )?,
        liquidated_funds_must_go_to_collector(
          outputs,
          own_input,
          liquidated_funds_collector_hash,
        )?,
      }

    IncreaseCollateral ->
      handle_increase_collateral(inputs, outputs, own_input, datum)

    _ -> False
  }
}

fn is_liquidation_threshold_reached(
  protocol_parameters_hash: ScriptHash,
  oracle_hash: ScriptHash,
  collateral_rate_in_lovelace: Int,
  reference_inputs: List<Input>,
  tusd_policy_id: PolicyId,
  tusd_asset_name: AssetName,
) {
  expect Some(protocol_parameters_ref) =
    find_input_by_hash(reference_inputs, protocol_parameters_hash)

  expect InlineDatum(protocol_parameters_datum) =
    protocol_parameters_ref.output.datum

  expect ProtocolParametersDatum {
    min_collateral_ratio,
    min_liquidation_threshold,
    ..
  } = protocol_parameters_datum

  expect Some(oracle_ref) = find_input_by_hash(reference_inputs, oracle_hash)

  let oracle_lovelace_value = lovelace_of(oracle_ref.output.value)
  let oracle_usd_value =
    quantity_of(oracle_ref.output.value, tusd_policy_id, tusd_asset_name)
  let oracle_lovelace_usd_rate =
    oracle_usd_value * usd_with_lovelace_precision_factor / oracle_lovelace_value

  let liquidation_rate =
    calculate_by_percentage(
      collateral_rate_in_lovelace,
      min_collateral_ratio,
      min_liquidation_threshold,
    )

  (oracle_lovelace_usd_rate <= liquidation_rate)?
}

fn liquidated_funds_must_go_to_collector(
  outputs: List<Output>,
  own_input: Input,
  liquidated_funds_collector_hash: ScriptHash,
) {
  expect InlineDatum(datum_data) = own_input.output.datum
  expect CollateralDatum { .. } = datum_data

  expect Some(collector_output) =
    find_output_by_hash(outputs, liquidated_funds_collector_hash)

  let own_input_lovelace_value = own_input.output.value |> lovelace_of
  let collector_output_lovelace_value = collector_output.value |> lovelace_of

  (own_input_lovelace_value == collector_output_lovelace_value)?
}

fn handle_increase_collateral(
  inputs: List<Input>,
  outputs: List<Output>,
  own_input: Input,
  datum: Option<CollateralValidatorDatum>,
) {
  expect Script(collateral_validator_hash) =
    own_input.output.address.payment_credential

  // Find input user balance
  expect Some(user_balance_input) =
    list.find(
      inputs,
      fn(input) {
        when input.output.datum is {
          InlineDatum(change_input_datum) ->
            if change_input_datum
            is DepositorDatum { .. }: CollateralValidatorDatum {
              (input.output.address.payment_credential == Script(
                collateral_validator_hash,
              ))?
            } else {
              False
            }
          _ -> False
        }
      },
    )
  expect InlineDatum(user_balance_input_datum) = user_balance_input.output.datum
  expect DepositorDatum { depositor_vkh } = user_balance_input_datum

  // Find output user balance with same depositor_vkh
  expect Some(user_balance_output) =
    list.find(
      outputs,
      fn(output) {
        when output.datum is {
          InlineDatum(output_datum) ->
            if output_datum
            is DepositorDatum { depositor_vkh: output_depositor_vkh }: CollateralValidatorDatum {
              and {
                (output.address.payment_credential == Script(
                  collateral_validator_hash,
                ))?,
                (depositor_vkh == output_depositor_vkh)?,
              }
            } else {
              False
            }
          _ -> False
        }
      },
    )

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
              if output_datum
              is CollateralDatum { .. }: CollateralValidatorDatum {
                True
              } else {
                False
              }
            _ -> False
          },
        }
      },
    )

  expect Some(CollateralDatum {
    tusd_pool_hash,
    tusd_policy_id,
    tusd_asset_name,
    tusd_borrowed,
    loan_nft_pid,
    loan_nft_asset_name,
    collateral_rate_in_lovelace,
    collateral_asset,
    collateral_amount_in_lovelace,
  }) = datum

  expect InlineDatum(collateral_output_datum) = collateral_output.datum
  expect CollateralDatum {
    tusd_pool_hash: output_tusd_pool_hash,
    tusd_policy_id: output_tusd_policy_id,
    tusd_asset_name: output_tusd_asset_name,
    tusd_borrowed: output_tusd_borrowed,
    loan_nft_pid: output_loan_nft_pid,
    loan_nft_asset_name: output_loan_nft_asset_name,
    collateral_rate_in_lovelace: output_collateral_rate_in_lovelace,
    collateral_asset: output_collateral_asset,
    collateral_amount_in_lovelace: output_collateral_amount_in_lovelace,
  } = collateral_output_datum

  // make sure there is loan NFT provided by the owner of the user account (Main validation requirement to allow for updating loan positions)
  expect Some(_loan_nft_input) =
    inputs
      |> list.find(
          fn(input) {
            and {
              (input.output.address.payment_credential == VerificationKey(
                depositor_vkh,
              ))?,
              ((
                input.output.value
                  |> quantity_of(loan_nft_pid, loan_nft_asset_name)
              ) == 1)?,
            }
          },
        )
  // make sure the loan NFT goes back to the person who provided it
  expect Some(_loan_nft_output) =
    outputs
      |> list.find(
          fn(output) {
            and {
              (output.address.payment_credential == VerificationKey(
                depositor_vkh,
              ))?,
              ((
                output.value |> quantity_of(loan_nft_pid, loan_nft_asset_name)
              ) == 1)?,
            }
          },
        )

  // calculate the amount of collateral user decided to increase with
  let collateral_increase_amount =
    lovelace_of(user_balance_input.output.value) - lovelace_of(
      user_balance_output.value,
    )

  and {
    tusd_pool_hash == output_tusd_pool_hash,
    tusd_policy_id == output_tusd_policy_id,
    tusd_asset_name == output_tusd_asset_name,
    tusd_borrowed == output_tusd_borrowed,
    loan_nft_pid == output_loan_nft_pid,
    loan_nft_asset_name == output_loan_nft_asset_name,
    collateral_rate_in_lovelace == output_collateral_rate_in_lovelace,
    collateral_asset == output_collateral_asset,
    // make sure the collateral is increased with the right amount
    output_collateral_amount_in_lovelace == collateral_amount_in_lovelace + collateral_increase_amount,
  }
}

fn handle_withdraw_and_increase_deposit(
  datum: Option<CollateralValidatorDatum>,
  redeemer: Action,
  extra_signatories: List<VerificationKeyHash>,
  own_input: Input,
  outputs: List<Output>,
) {
  expect Some(DepositorDatum { depositor_vkh }) = datum

  when redeemer is {
    WithdrawDeposit -> signed_by(extra_signatories, depositor_vkh)?
    IncreaseDeposit | PartialWithdrawal -> {
      expect Script(own_hash) = own_input.output.address.payment_credential
      expect Some(deposit_output) =
        list.find(
          outputs,
          fn(output) {
            and {
              trace @"own_hash": own_hash
              (output.address.payment_credential == Script(own_hash))?,
              when output.datum is {
                InlineDatum(output_datum) ->
                  if output_datum is CollateralValidatorDatum {
                    when output_datum is {
                      DepositorDatum { .. } -> True
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
      expect InlineDatum(deposit_output_datum) = deposit_output.datum
      expect DepositorDatum { depositor_vkh: output_depositor_vkh } =
        deposit_output_datum

      expect and {
          (depositor_vkh == output_depositor_vkh)?,
          signed_by(extra_signatories, depositor_vkh)?,
        }

      when redeemer is {
        IncreaseDeposit -> and {
            // To allow for increase deposit, total deposit has to be greater than initial balance
            (lovelace_of(deposit_output.value) > lovelace_of(
              own_input.output.value,
            ))?,
            // Make sure that the identifier token is sent with the deposit and no other asset is sent
            (assets.without_lovelace(deposit_output.value) == from_asset(
              own_hash,
              identifier_token_name,
              1,
            ))?,
          }
        PartialWithdrawal -> {
          // Expect an output to the depositor vkh whose lovelace value is the exact withdrawal amount
          expect Some(_withdrawal_output) =
            outputs
              |> list.find(
                  fn(output) {
                    and {
                      output.address.payment_credential == VerificationKey(
                        depositor_vkh,
                      ),
                      lovelace_of(output.value) == lovelace_of(
                        own_input.output.value,
                      ) - lovelace_of(deposit_output.value),
                    }
                  },
                )
          and {
            // To allow for partial withdrawal, final balance has to be less than initial balance
            (lovelace_of(deposit_output.value) < lovelace_of(
              own_input.output.value,
            ))?,
            // Make sure that the identifier token is sent with the deposit and no other asset is sent
            (assets.without_lovelace(deposit_output.value) == from_asset(
              own_hash,
              identifier_token_name,
              1,
            ))?,
          }
        }
        _ -> False
      }
    }
    _ -> False
  }
}

// Tests
fn get_collateral_details() {
  let loan_nft_policy_id = mock_policy_id(0)

  let collateral_validator_script_hash = mock_script_hash(2)
  let tusd_pool_script_hash = mock_script_hash(3)
  let test_usd_policy_id = mock_policy_id(0)
  let test_usd_asset_name = "tUSD"
  let collateral_amount_in_lovelace = 15000000
  let loan_nft_name = "BorrowNFT1"
  let collateral_datum =
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
    }
  let collateral_input =
    Input {
      output_reference: mock_utxo_ref(0, 1),
      output: Output {
        address: Address {
          payment_credential: Script(collateral_validator_script_hash),
          stake_credential: None,
        },
        value: from_lovelace(collateral_amount_in_lovelace),
        datum: InlineDatum(collateral_datum),
        reference_script: None,
      },
    }

  (collateral_datum, collateral_input)
}

test test_refund_loan() {
  let loan_nft_policy_id = mock_policy_id(0)
  let protocol_parameters_script_hash = mock_script_hash(1)
  let oracle_script_hash = mock_script_hash(4)
  let liquidated_funds_collector_script_hash = mock_script_hash(5)
  let collateral_input_utxo_ref = mock_utxo_ref(0, 1)
  let loan_nft_name = "BorrowNFT1"

  let (collateral_datum, collateral_input) = get_collateral_details()

  let mint =
    from_asset_list([Pair(loan_nft_policy_id, [Pair(loan_nft_name, -1)])])

  let tx = Transaction { ..placeholder, inputs: [collateral_input], mint: mint }

  collateral_validator.spend(
    protocol_parameters_script_hash,
    oracle_script_hash,
    liquidated_funds_collector_script_hash,
    Some(collateral_datum),
    Refund,
    collateral_input_utxo_ref,
    tx,
  )
}

test test_liquidate_loan_with_liquidation_threshold_reached() {
  let protocol_parameters_script_hash = mock_script_hash(1)
  let oracle_script_hash = mock_script_hash(4)
  let liquidated_funds_collector_script_hash = mock_script_hash(5)
  let collateral_input_utxo_ref = mock_utxo_ref(0, 1)
  let collateral_amount_in_lovelace = 15000000

  let (collateral_datum, collateral_input) = get_collateral_details()

  let protocol_parameters_ref =
    Input {
      output_reference: mock_utxo_ref(0, 1),
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

  let test_usd_policy_id = mock_policy_id(0)
  let test_usd_asset_name = "tUSD"
  let oracle_ref =
    Input {
      output_reference: mock_utxo_ref(0, 2),
      output: Output {
        address: Address {
          payment_credential: Script(oracle_script_hash),
          stake_credential: None,
        },
        // $24 / 40000000 lovelaces == $0.6/lovelace lower than liq. price
        //  (initial price was $1.2)
        value: assets.merge(
          from_lovelace(40000000),
          from_asset(test_usd_policy_id, test_usd_asset_name, 24),
        ),
        datum: NoDatum,
        reference_script: None,
      },
    }

  let collector_output =
    Output {
      address: Address {
        payment_credential: Script(liquidated_funds_collector_script_hash),
        stake_credential: None,
      },
      value: from_lovelace(collateral_amount_in_lovelace),
      datum: NoDatum,
      reference_script: None,
    }

  let tx =
    Transaction {
      ..placeholder,
      inputs: [collateral_input],
      outputs: [collector_output],
      reference_inputs: [protocol_parameters_ref, oracle_ref],
    }

  collateral_validator.spend(
    protocol_parameters_script_hash,
    oracle_script_hash,
    liquidated_funds_collector_script_hash,
    Some(collateral_datum),
    Liquidate,
    collateral_input_utxo_ref,
    tx,
  )
}

test test_spend_deposit() {
  let protocol_parameters_script_hash = mock_script_hash(1)
  let oracle_script_hash = mock_script_hash(4)
  let liquidated_funds_collector_script_hash = mock_script_hash(5)
  let deposit_input_utxo_ref = mock_utxo_ref(0, 1)
  let collateral_validator_script_hash = mock_script_hash(2)
  let depositor_vkh = mock_pub_key_hash(0)

  let deposit_datum = DepositorDatum { depositor_vkh }
  let deposit_input =
    Input {
      output_reference: deposit_input_utxo_ref,
      output: Output {
        address: Address {
          payment_credential: Script(collateral_validator_script_hash),
          stake_credential: None,
        },
        value: from_lovelace(2000000),
        datum: InlineDatum(deposit_datum),
        reference_script: None,
      },
    }

  let tx =
    Transaction {
      ..placeholder,
      inputs: [deposit_input],
      extra_signatories: [depositor_vkh],
    }

  collateral_validator.spend(
    protocol_parameters_script_hash,
    oracle_script_hash,
    liquidated_funds_collector_script_hash,
    Some(deposit_datum),
    WithdrawDeposit,
    deposit_input_utxo_ref,
    tx,
  )
}

test test_deposit_value() {
  let protocol_parameters_script_hash = mock_script_hash(1)
  let oracle_script_hash = mock_script_hash(4)
  let liquidated_funds_collector_script_hash = mock_script_hash(5)
  let deposit_input_utxo_ref = mock_utxo_ref(0, 1)
  let depositor_vkh = mock_pub_key_hash(0)
  let collateral_validator_script_hash = mock_script_hash(2)

  let deposit_input =
    Input {
      output_reference: deposit_input_utxo_ref,
      output: Output {
        address: Address {
          payment_credential: VerificationKey(depositor_vkh),
          stake_credential: None,
        },
        value: from_lovelace(5000000),
        datum: NoDatum,
        reference_script: None,
      },
    }
  let deposit_input2 =
    Input {
      output_reference: deposit_input_utxo_ref,
      output: Output {
        address: Address {
          payment_credential: VerificationKey(depositor_vkh),
          stake_credential: None,
        },
        value: from_lovelace(2000000),
        datum: NoDatum,
        reference_script: None,
      },
    }

  let identifier =
    from_asset(collateral_validator_script_hash, "st-identifier", 1)

  let deposit_datum = DepositorDatum { depositor_vkh }
  let deposit_output =
    Output {
      address: Address {
        payment_credential: Script(collateral_validator_script_hash),
        stake_credential: None,
      },
      value: assets.merge(from_lovelace(4000000), identifier),
      datum: InlineDatum(deposit_datum),
      reference_script: None,
    }

  let receipt =
    from_asset(collateral_validator_script_hash, "statera-receipt", 1)

  let depositor_output =
    Output {
      address: Address {
        payment_credential: VerificationKey(depositor_vkh),
        stake_credential: None,
      },
      value: assets.merge(from_lovelace(2000000), receipt),
      datum: NoDatum,
      reference_script: None,
    }

  let tx =
    Transaction {
      ..placeholder,
      inputs: [deposit_input, deposit_input2],
      outputs: [deposit_output, depositor_output],
      mint: assets.merge(receipt, identifier),
    }

  collateral_validator.mint(
    protocol_parameters_script_hash,
    oracle_script_hash,
    liquidated_funds_collector_script_hash,
    "",
    collateral_validator_script_hash,
    tx,
  )
}

test test_increase_deposit() {
  let protocol_parameters_script_hash = mock_script_hash(1)
  let oracle_script_hash = mock_script_hash(4)
  let liquidated_funds_collector_script_hash = mock_script_hash(5)
  let deposit_input_utxo_ref = mock_utxo_ref(0, 1)
  let depositor_vkh = mock_pub_key_hash(0)
  let collateral_validator_script_hash = mock_script_hash(2)

  let depositor_input =
    Input {
      output_reference: mock_utxo_ref(0, 3),
      output: Output {
        address: Address {
          payment_credential: VerificationKey(depositor_vkh),
          stake_credential: None,
        },
        value: from_lovelace(5000000),
        datum: NoDatum,
        reference_script: None,
      },
    }

  let deposit_datum = DepositorDatum { depositor_vkh }
  let deposit_input =
    Input {
      output_reference: deposit_input_utxo_ref,
      output: Output {
        address: Address {
          payment_credential: Script(collateral_validator_script_hash),
          stake_credential: None,
        },
        value: from_lovelace(4000000),
        datum: InlineDatum(deposit_datum),
        reference_script: None,
      },
    }
  let deposit_output =
    Output {
      address: Address {
        payment_credential: Script(collateral_validator_script_hash),
        stake_credential: None,
      },
      value: assets.merge(
        from_lovelace(5000000),
        from_asset(collateral_validator_script_hash, identifier_token_name, 1),
      ),
      datum: InlineDatum(deposit_datum),
      reference_script: None,
    }

  let tx =
    Transaction {
      ..placeholder,
      inputs: [deposit_input, depositor_input],
      outputs: [deposit_output],
      extra_signatories: [depositor_vkh],
    }

  collateral_validator.spend(
    protocol_parameters_script_hash,
    oracle_script_hash,
    liquidated_funds_collector_script_hash,
    Some(deposit_datum),
    IncreaseDeposit,
    deposit_input_utxo_ref,
    tx,
  )
}

test test_partial_withdrawal() {
  let protocol_parameters_script_hash = mock_script_hash(1)
  let oracle_script_hash = mock_script_hash(4)
  let liquidated_funds_collector_script_hash = mock_script_hash(5)
  let deposit_input_utxo_ref = mock_utxo_ref(0, 1)
  let depositor_vkh = mock_pub_key_hash(0)
  let collateral_validator_script_hash = mock_script_hash(2)

  let depositor_output =
    Output {
      address: Address {
        payment_credential: VerificationKey(depositor_vkh),
        stake_credential: None,
      },
      value: from_lovelace(1000000),
      datum: NoDatum,
      reference_script: None,
    }

  let deposit_datum = DepositorDatum { depositor_vkh }
  let deposit_input =
    Input {
      output_reference: deposit_input_utxo_ref,
      output: Output {
        address: Address {
          payment_credential: Script(collateral_validator_script_hash),
          stake_credential: None,
        },
        value: assets.merge(
          from_lovelace(5000000),
          from_asset(collateral_validator_script_hash, identifier_token_name, 1),
        ),
        datum: InlineDatum(deposit_datum),
        reference_script: None,
      },
    }
  let deposit_output =
    Output {
      address: Address {
        payment_credential: Script(collateral_validator_script_hash),
        stake_credential: None,
      },
      value: assets.merge(
        from_lovelace(4000000),
        from_asset(collateral_validator_script_hash, identifier_token_name, 1),
      ),
      datum: InlineDatum(deposit_datum),
      reference_script: None,
    }

  let tx =
    Transaction {
      ..placeholder,
      inputs: [deposit_input],
      outputs: [deposit_output, depositor_output],
      extra_signatories: [depositor_vkh],
    }

  collateral_validator.spend(
    protocol_parameters_script_hash,
    oracle_script_hash,
    liquidated_funds_collector_script_hash,
    Some(deposit_datum),
    PartialWithdrawal,
    deposit_input_utxo_ref,
    tx,
  )
}

test test_increase_collateral() {
  let protocol_parameters_script_hash = mock_script_hash(1)
  let oracle_script_hash = mock_script_hash(4)
  let liquidated_funds_collector_script_hash = mock_script_hash(5)
  let depositor_vkh = mock_pub_key_hash(0)
  let collateral_validator_script_hash = mock_script_hash(2)

  let (collateral_datum, collateral_input) = get_collateral_details()
  expect CollateralDatum {
    tusd_pool_hash,
    tusd_policy_id,
    tusd_asset_name,
    tusd_borrowed,
    loan_nft_pid,
    loan_nft_asset_name,
    collateral_rate_in_lovelace,
    collateral_asset,
    ..
  } = collateral_datum

  let user_wallet_input =
    Input {
      output_reference: mock_utxo_ref(0, 11),
      output: Output {
        address: Address {
          payment_credential: VerificationKey(depositor_vkh),
          stake_credential: None,
        },
        value: assets.merge(
          from_lovelace(1000000),
          from_asset(loan_nft_pid, loan_nft_asset_name, 1),
        ),
        datum: NoDatum,
        reference_script: None,
      },
    }
  let user_wallet_output =
    Output {
      address: Address {
        payment_credential: VerificationKey(depositor_vkh),
        stake_credential: None,
      },
      value: assets.merge(
        from_lovelace(1000000),
        from_asset(loan_nft_pid, loan_nft_asset_name, 1),
      ),
      datum: NoDatum,
      reference_script: None,
    }

  let deposit_datum = DepositorDatum { depositor_vkh }
  let user_balance_input =
    Input {
      output_reference: mock_utxo_ref(0, 9),
      output: Output {
        address: Address {
          payment_credential: Script(collateral_validator_script_hash),
          stake_credential: None,
        },
        value: assets.merge(
          from_lovelace(5000000),
          from_asset(collateral_validator_script_hash, identifier_token_name, 1),
        ),
        datum: InlineDatum(deposit_datum),
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
        from_lovelace(4000000),
        from_asset(collateral_validator_script_hash, identifier_token_name, 1),
      ),
      datum: InlineDatum(deposit_datum),
      reference_script: None,
    }

  // let previous_collateral_amount_in_lovelace = 15000000
  // let updated_collateral_amount_in_lovelace = previous_collateral_amount_in_lovelace + (lovelace_of(user_balance_input.output.value) - lovelace_of(user_balance_output.value))
  // let collateral_output = Output {
  //   ..collateral_input.output,
  //   datum: InlineDatum(CollateralValidatorDatum {CollateralDatum {
  //     ..collateral_input.output.datum,
  //     collateral_amount_in_lovelace: updated_collateral_amount_in_lovelace,
  //   }}),
  //   value: from_lovelace(updated_collateral_amount_in_lovelace)
  // }
  let previous_collateral_amount_in_lovelace = 15000000
  let updated_collateral_amount_in_lovelace =
    previous_collateral_amount_in_lovelace + (
      lovelace_of(user_balance_input.output.value) - lovelace_of(
        user_balance_output.value,
      )
    )
  let output_collateral_datum =
    CollateralDatum {
      tusd_pool_hash,
      tusd_policy_id,
      tusd_asset_name,
      tusd_borrowed,
      loan_nft_pid,
      loan_nft_asset_name,
      collateral_rate_in_lovelace,
      collateral_asset,
      collateral_amount_in_lovelace: updated_collateral_amount_in_lovelace,
    }
  let collateral_output =
    Output {
      address: Address {
        payment_credential: Script(collateral_validator_script_hash),
        stake_credential: None,
      },
      value: from_lovelace(updated_collateral_amount_in_lovelace),
      datum: InlineDatum(output_collateral_datum),
      reference_script: None,
    }

  let tx =
    Transaction {
      ..placeholder,
      inputs: [user_wallet_input, user_balance_input, collateral_input],
      outputs: [user_wallet_output, user_balance_output, collateral_output],
      extra_signatories: [depositor_vkh],
    }

  collateral_validator.spend(
    protocol_parameters_script_hash,
    oracle_script_hash,
    liquidated_funds_collector_script_hash,
    Some(collateral_datum),
    IncreaseCollateral,
    collateral_input.output_reference,
    tx,
  )
}
