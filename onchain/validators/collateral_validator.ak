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
use mocktail/virgin_key_hash.{
  mock_policy_id, mock_pub_key_hash, mock_script_hash,
}
use mocktail/virgin_output_reference.{mock_utxo_ref}
use statera/constants.{
  identifier_token_name, precision_factor, receipt_token_name,
  st_liquidation_asset_name, st_oracle_asset_name, st_pparams_asset_name,
  st_stable_asset_name,
}
use statera/datums.{
  CollateralDatum, CollateralValidatorDatum, DepositorDatum, LiqFundsDatum,
  OracleDatum, ProtocolParametersDatum,
}
use statera/types.{AssetRate, AssetType}
use statera/utils.{
  calculate_by_percentage, filter_inputs_by_vkh, find_oracle_rate,
  find_output_by_hash, find_output_by_vkh, find_ucv_ref_input,
  get_user_asset_amt_in_out, signed_by,
}

pub type Action {
  Refund
  Liquidate
  WithdrawDeposit
  IncreaseDeposit
  PartialWithdrawal
  IncreaseCollateral
  PartialRepayment
}

validator collateral_validator(
  // protocol_parameters_hash: ScriptHash,
  // oracle_hash: ScriptHash,
  // liquidated_funds_collector_hash: ScriptHash,
  unified_control_validator_hash: ScriptHash,
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
          unified_control_validator_hash,
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
        receipt_name == receipt_token_name,
        receipt_quantity == 1,
        identifier_name == identifier_token_name,
        identifier_quantity == 1,
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
  unified_control_validator_hash: ScriptHash,
  datum: Option<CollateralValidatorDatum>,
  redeemer: Action,
  mint: Value,
  outputs: List<Output>,
  reference_inputs: List<Input>,
  own_input: Input,
  inputs: List<Input>,
) {
  expect Some(CollateralDatum {
    loan_nft_pid,
    collateral_rate_at_lending_precised,
    collateral_asset,
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
          unified_control_validator_hash,
          collateral_rate_at_lending_precised,
          reference_inputs,
          collateral_asset,
        ),
        liquidated_funds_must_go_to_collector(
          reference_inputs,
          outputs,
          own_input,
          unified_control_validator_hash,
        ),
      }

    IncreaseCollateral ->
      handle_increase_collateral(inputs, outputs, own_input, datum)

    PartialRepayment ->
      handle_partial_repayment(inputs, outputs, own_input, datum, mint)

    _ -> False
  }
}

fn is_liquidation_threshold_reached(
  unified_control_validator_hash: ScriptHash,
  collateral_rate_at_lending_precised: Int,
  reference_inputs: List<Input>,
  collateral_asset: AssetType,
) {
  expect Some(protocol_parameters_ref) =
    find_ucv_ref_input(
      reference_inputs,
      unified_control_validator_hash,
      st_pparams_asset_name,
    )

  expect InlineDatum(protocol_parameters_datum) =
    protocol_parameters_ref.output.datum

  expect ProtocolParametersDatum { min_liquidation_threshold, .. } =
    protocol_parameters_datum

  let AssetType {
    policy_id: collateral_asset_pid,
    asset_name: collateral_asset_an,
    ..
  } = collateral_asset

  expect Some(oracle_ref) =
    find_ucv_ref_input(
      reference_inputs,
      unified_control_validator_hash,
      st_oracle_asset_name,
    )
  expect Some(oracle_rate) =
    find_oracle_rate(oracle_ref, collateral_asset_pid, collateral_asset_an)

  let AssetRate { num, denum, .. } = oracle_rate
  let oracle_asset_st_rate = num * precision_factor / denum

  let liquidation_rate =
    calculate_by_percentage(
      collateral_rate_at_lending_precised,
      100,
      min_liquidation_threshold,
    )

  (oracle_asset_st_rate <= liquidation_rate)?
}

fn liquidated_funds_must_go_to_collector(
  reference_inputs: List<Input>,
  outputs: List<Output>,
  own_input: Input,
  unified_control_validator_hash: ScriptHash,
) {
  expect InlineDatum(datum_data) = own_input.output.datum
  expect CollateralDatum { collateral_asset, .. } = datum_data
  let AssetType {
    policy_id: collateral_asset_pid,
    asset_name: collateral_asset_an,
    ..
  } = collateral_asset

  expect Some(liquidated_funds_receiver_ref) =
    find_ucv_ref_input(
      reference_inputs,
      unified_control_validator_hash,
      st_liquidation_asset_name,
    )
  expect InlineDatum(liq_funds_datum) =
    liquidated_funds_receiver_ref.output.datum
  expect LiqFundsDatum { receiver } = liq_funds_datum

  expect Some(collector_output) = find_output_by_hash(outputs, receiver)

  let own_input_value =
    if collateral_asset_pid == "" {
      own_input.output.value |> lovelace_of
    } else {
      quantity_of(
        own_input.output.value,
        collateral_asset_pid,
        collateral_asset_an,
      )
    }
  let collector_output_value =
    if collateral_asset_pid == "" {
      collector_output.value |> lovelace_of
    } else {
      quantity_of(
        collector_output.value,
        collateral_asset_pid,
        collateral_asset_an,
      )
    }

  (own_input_value == collector_output_value)?
}

fn handle_increase_collateral(
  inputs: List<Input>,
  outputs: List<Output>,
  own_input: Input,
  datum: Option<CollateralValidatorDatum>,
) {
  expect Script(collateral_validator_hash) =
    own_input.output.address.payment_credential

  // Destructure datum from collateral validator
  expect Some(CollateralDatum {
    st_policy_id,
    st_asset_name,
    st_borrowed,
    loan_nft_pid,
    loan_nft_asset_name,
    collateral_rate_at_lending_precised,
    collateral_asset,
    collateral_asset_amount,
  }) = datum

  let AssetType {
    policy_id: collateral_asset_pid,
    asset_name: collateral_asset_an,
    ..
  } = collateral_asset

  expect Some(collateral_output) =
    list.find(
      outputs,
      fn(output) {
        and {
          output.address.payment_credential == Script(collateral_validator_hash),
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
  expect InlineDatum(collateral_output_datum) = collateral_output.datum
  expect CollateralDatum {
    st_policy_id: output_st_policy_id,
    st_asset_name: output_st_asset_name,
    st_borrowed: output_st_borrowed,
    loan_nft_pid: output_loan_nft_pid,
    loan_nft_asset_name: output_loan_nft_asset_name,
    collateral_rate_at_lending_precised: output_collateral_rate_at_lending_precised,
    collateral_asset: output_collateral_asset,
    collateral_asset_amount: output_collateral_asset_amount,
  } = collateral_output_datum

  let (total_col_asset_in_amt, total_col_asset_out_amt, user_vkh) =
    if collateral_asset_pid == "" {
      validate_increase_ada_collateral(
        collateral_validator_hash,
        inputs,
        outputs,
      )
    } else {
      expect Some(loan_nft_input) =
        inputs
          |> list.find(
              fn(input) {
                (
                  input.output.value
                    |> quantity_of(loan_nft_pid, loan_nft_asset_name)
                ) == 1
              },
            )
      expect VerificationKey(user_vkh) =
        loan_nft_input.output.address.payment_credential

      validate_increase_other_assets_collateral(
        inputs,
        outputs,
        collateral_asset_pid,
        collateral_asset_an,
        user_vkh,
      )
    }

  // make sure there is loan NFT provided by the owner of the user account (Main validation requirement to allow for updating loan positions)
  expect Some(_loan_nft_input) =
    inputs
      |> list.find(
          fn(input) {
            and {
              input.output.address.payment_credential == VerificationKey(
                user_vkh,
              ),
              (
                input.output.value
                  |> quantity_of(loan_nft_pid, loan_nft_asset_name)
              ) == 1,
            }
          },
        )
  // make sure the loan NFT goes back to the person who provided it
  expect Some(_loan_nft_output) =
    outputs
      |> list.find(
          fn(output) {
            and {
              output.address.payment_credential == VerificationKey(user_vkh),
              ( output.value |> quantity_of(loan_nft_pid, loan_nft_asset_name) ) == 1,
            }
          },
        )

  // calculate the amount of collateral user decided to increase with
  let collateral_increase_amount =
    total_col_asset_in_amt - total_col_asset_out_amt
  let expected_new_collateral_balance =
    collateral_asset_amount + collateral_increase_amount

  and {
    st_policy_id == output_st_policy_id,
    st_asset_name == output_st_asset_name,
    st_borrowed == output_st_borrowed,
    loan_nft_pid == output_loan_nft_pid,
    loan_nft_asset_name == output_loan_nft_asset_name,
    collateral_rate_at_lending_precised == output_collateral_rate_at_lending_precised,
    collateral_asset == output_collateral_asset,
    // make sure the collateral is increased with the right amount
    (output_collateral_asset_amount == expected_new_collateral_balance)?,
    // make sure collateral value is not tampered with
    if collateral_asset_pid == "" {
      (lovelace_of(collateral_output.value) == expected_new_collateral_balance)?
    } else {
      trace @"qtof..": quantity_of(
        collateral_output.value,
        collateral_asset_pid,
        collateral_asset_an,
      )
      trace @"expected_new_collateral_balance": expected_new_collateral_balance
      (quantity_of(
        collateral_output.value,
        collateral_asset_pid,
        collateral_asset_an,
      ) == expected_new_collateral_balance)?
    },
  }
}

fn validate_increase_ada_collateral(
  collateral_validator_hash: ScriptHash,
  inputs: List<Input>,
  outputs: List<Output>,
) {
  // Find input user balance
  expect Some(user_balance_input) =
    list.find(
      inputs,
      fn(input) {
        when input.output.datum is {
          InlineDatum(change_input_datum) ->
            if change_input_datum
            is DepositorDatum { .. }: CollateralValidatorDatum {
              input.output.address.payment_credential == Script(
                collateral_validator_hash,
              )
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
                output.address.payment_credential == Script(
                  collateral_validator_hash,
                ),
                depositor_vkh == output_depositor_vkh,
              }
            } else {
              False
            }
          _ -> False
        }
      },
    )

  (
    lovelace_of(user_balance_input.output.value),
    lovelace_of(user_balance_output.value),
    depositor_vkh,
  )
}

fn validate_increase_other_assets_collateral(
  inputs: List<Input>,
  outputs: List<Output>,
  collateral_asset_pid: PolicyId,
  collateral_asset_an: AssetName,
  user_vkh: VerificationKeyHash,
) {
  let (user_wallet_total_col_asset_input, user_wallet_total_col_asset_output) =
    get_user_asset_amt_in_out(
      inputs,
      outputs,
      user_vkh,
      collateral_asset_pid,
      collateral_asset_an,
    )

  (
    user_wallet_total_col_asset_input,
    user_wallet_total_col_asset_output,
    user_vkh,
  )
}

fn handle_partial_repayment(
  inputs: List<Input>,
  outputs: List<Output>,
  own_input: Input,
  datum: Option<CollateralValidatorDatum>,
  mint: Value,
) {
  expect Script(collateral_validator_hash) =
    own_input.output.address.payment_credential

  expect Some(CollateralDatum {
    st_policy_id,
    st_asset_name,
    st_borrowed,
    loan_nft_pid,
    loan_nft_asset_name,
    collateral_rate_at_lending_precised,
    collateral_asset,
    collateral_asset_amount,
  }) = datum

  // Check for loan amount burning and burned amount
  expect [Pair(loan_token_name, loan_token_burn_quantity)] =
    mint |> assets.tokens(st_policy_id) |> dict.to_pairs
  expect loan_token_burn_quantity < 0

  expect Some(collateral_output) =
    list.find(
      outputs,
      fn(output) {
        and {
          output.address.payment_credential == Script(collateral_validator_hash),
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
  expect InlineDatum(collateral_output_datum) = collateral_output.datum
  expect CollateralDatum {
    st_policy_id: output_st_policy_id,
    st_asset_name: output_st_asset_name,
    st_borrowed: output_st_borrowed,
    loan_nft_pid: output_loan_nft_pid,
    loan_nft_asset_name: output_loan_nft_asset_name,
    collateral_rate_at_lending_precised: output_collateral_rate_at_lending_precised,
    collateral_asset: output_collateral_asset,
    collateral_asset_amount: output_collateral_asset_amount,
  } = collateral_output_datum

  // make sure there is loan NFT provided by the owner of the user account (Main validation requirement to allow for updating loan positions)
  expect Some(loan_nft_input) =
    inputs
      |> list.find(
          fn(input) {
            (
              input.output.value
                |> quantity_of(loan_nft_pid, loan_nft_asset_name)
            ) == 1
          },
        )
  // make sure the loan NFT goes back to the person who provided it
  expect Some(_loan_nft_output) =
    outputs
      |> list.find(
          fn(output) {
            and {
              output.address.payment_credential == loan_nft_input.output.address.payment_credential,
              ( output.value |> quantity_of(loan_nft_pid, loan_nft_asset_name) ) == 1,
            }
          },
        )

  expect VerificationKey(user_vkh) =
    loan_nft_input.output.address.payment_credential
  let (user_wallet_total_st_asset_input, user_wallet_total_st_asset_output) =
    get_user_asset_amt_in_out(
      inputs,
      outputs,
      user_vkh,
      st_policy_id,
      st_asset_name,
    )
  let user_st_amount_given =
    user_wallet_total_st_asset_input - user_wallet_total_st_asset_output
  // Make sure loan_token_burn_quantity is the exact same amount of st going out of the user's wallet
  trace @"user_st_amount_given": user_st_amount_given
  trace @"loan_token_burn_quantity": loan_token_burn_quantity
  expect user_st_amount_given == -1 * loan_token_burn_quantity

  // calculate the amount of remaining unpaid loan
  let remaining_unpaid_loan = st_borrowed - -1 * loan_token_burn_quantity

  and {
    st_policy_id == output_st_policy_id,
    st_asset_name == output_st_asset_name,
    // output loan borrowed in datum should be updated
    output_st_borrowed == remaining_unpaid_loan,
    loan_nft_pid == output_loan_nft_pid,
    loan_nft_asset_name == output_loan_nft_asset_name,
    collateral_rate_at_lending_precised == output_collateral_rate_at_lending_precised,
    collateral_asset == output_collateral_asset,
    collateral_asset_amount == output_collateral_asset_amount,
    // loan token is really the loan token
    st_asset_name == loan_token_name,
    // make sure collateral value is not tampered with
    own_input.output.value == collateral_output.value,
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
              output.address.payment_credential == Script(own_hash),
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
        PartialWithdrawal -> and {
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
        _ -> False
      }
    }
    _ -> False
  }
}

// Tests
fn get_collateral_details() {
  let loan_nfst_policy_id = mock_policy_id(0)

  let collateral_validator_script_hash = mock_script_hash(2)
  let test_st_policy_id = mock_policy_id(0)
  let test_st_asset_name = st_stable_asset_name
  let collateral_asset_amount = 15000000
  let loan_nft_name = "BorrowNFT1"
  let collateral_datum =
    CollateralDatum {
      st_policy_id: test_st_policy_id,
      st_asset_name: test_st_asset_name,
      st_borrowed: 12,
      loan_nft_pid: loan_nfst_policy_id,
      loan_nft_asset_name: loan_nft_name,
      // $1.2 (per ADA)
      collateral_rate_at_lending_precised: 1200000,
      collateral_asset: AssetType {
        is_stable: False,
        policy_id: "",
        asset_name: "lovelace",
      },
      collateral_asset_amount,
    }
  let collateral_input =
    Input {
      output_reference: mock_utxo_ref(0, 1),
      output: Output {
        address: Address {
          payment_credential: Script(collateral_validator_script_hash),
          stake_credential: None,
        },
        value: from_lovelace(collateral_asset_amount),
        datum: InlineDatum(collateral_datum),
        reference_script: None,
      },
    }

  (collateral_datum, collateral_input)
}

test test_refund_loan() {
  let loan_nfst_policy_id = mock_policy_id(0)
  let unified_control_validator_hash = mock_script_hash(1)
  // let oracle_script_hash = mock_script_hash(4)
  // let liquidated_funds_collector_script_hash = mock_script_hash(5)
  let collateral_input_utxo_ref = mock_utxo_ref(0, 1)
  let loan_nft_name = "BorrowNFT1"

  let (collateral_datum, collateral_input) = get_collateral_details()

  let mint =
    from_asset_list([Pair(loan_nfst_policy_id, [Pair(loan_nft_name, -1)])])

  let tx = Transaction { ..placeholder, inputs: [collateral_input], mint: mint }

  collateral_validator.spend(
    unified_control_validator_hash,
    Some(collateral_datum),
    Refund,
    collateral_input_utxo_ref,
    tx,
  )
}

test test_liquidate_loan_with_liquidation_threshold_reached() {
  let unified_control_validator_hash = mock_script_hash(1)
  let collateral_input_utxo_ref = mock_utxo_ref(0, 1)
  let collateral_asset_amount = 15000000

  let (collateral_datum, collateral_input) = get_collateral_details()

  let protocol_parameters_ref =
    Input {
      output_reference: mock_utxo_ref(0, 1),
      output: Output {
        address: Address {
          payment_credential: Script(unified_control_validator_hash),
          stake_credential: None,
        },
        value: assets.merge(
          from_lovelace(2000000),
          from_asset(unified_control_validator_hash, st_pparams_asset_name, 1),
        ),
        datum: InlineDatum(
          ProtocolParametersDatum {
            min_collateral_ratio: 150,
            min_liquidation_threshold: 120,
            min_loan_amount: 10,
            protocol_usage_fee: 2,
            collateral_assets: [
              AssetType {
                is_stable: False,
                policy_id: "",
                asset_name: "lovelace",
              },
              AssetType {
                is_stable: True,
                policy_id: mock_policy_id(0),
                asset_name: "iUSD",
              },
              AssetType {
                is_stable: False,
                policy_id: mock_policy_id(1),
                asset_name: "hosky",
              },
            ],
          },
        ),
        reference_script: None,
      },
    }

  let oracle_ref =
    Input {
      output_reference: mock_utxo_ref(0, 2),
      output: Output {
        address: Address {
          payment_credential: Script(unified_control_validator_hash),
          stake_credential: None,
        },
        value: assets.merge(
          from_lovelace(2000000),
          from_asset(unified_control_validator_hash, st_oracle_asset_name, 1),
        ),
        datum: InlineDatum(
          OracleDatum {
            oracle_rates: [
              AssetRate { unit: "lovelace", num: 24, denum: 40000000 },
            ],
          },
        ),
        reference_script: None,
      },
    }

  let liq_funds_receiver = mock_script_hash(5)
  let liquidated_funds_receiver_ref =
    Input {
      output_reference: mock_utxo_ref(0, 2),
      output: Output {
        address: Address {
          payment_credential: Script(unified_control_validator_hash),
          stake_credential: None,
        },
        value: assets.merge(
          from_lovelace(2000000),
          from_asset(
            unified_control_validator_hash,
            st_liquidation_asset_name,
            1,
          ),
        ),
        datum: InlineDatum(LiqFundsDatum { receiver: liq_funds_receiver }),
        reference_script: None,
      },
    }

  let collector_output =
    Output {
      address: Address {
        payment_credential: Script(liq_funds_receiver),
        stake_credential: None,
      },
      value: from_lovelace(collateral_asset_amount),
      datum: NoDatum,
      reference_script: None,
    }

  let tx =
    Transaction {
      ..placeholder,
      inputs: [collateral_input],
      outputs: [collector_output],
      reference_inputs: [
        protocol_parameters_ref, oracle_ref, liquidated_funds_receiver_ref,
      ],
    }

  collateral_validator.spend(
    unified_control_validator_hash,
    Some(collateral_datum),
    Liquidate,
    collateral_input_utxo_ref,
    tx,
  )
}

test test_spend_deposit() {
  let unified_control_validator_hash = mock_script_hash(1)
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
    unified_control_validator_hash,
    Some(deposit_datum),
    WithdrawDeposit,
    deposit_input_utxo_ref,
    tx,
  )
}

test test_deposit_value() {
  let unified_control_validator_hash = mock_script_hash(1)
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
    from_asset(collateral_validator_script_hash, identifier_token_name, 1)

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
    from_asset(collateral_validator_script_hash, receipt_token_name, 1)

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
    unified_control_validator_hash,
    "",
    collateral_validator_script_hash,
    tx,
  )
}

test test_increase_deposit() {
  let unified_control_validator_hash = mock_script_hash(1)
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
    unified_control_validator_hash,
    Some(deposit_datum),
    IncreaseDeposit,
    deposit_input_utxo_ref,
    tx,
  )
}

test test_partial_withdrawal() {
  let unified_control_validator_hash = mock_script_hash(1)
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
    unified_control_validator_hash,
    Some(deposit_datum),
    PartialWithdrawal,
    deposit_input_utxo_ref,
    tx,
  )
}

test test_increase_ada_collateral() {
  let unified_control_validator_hash = mock_script_hash(1)
  let depositor_vkh = mock_pub_key_hash(0)
  let collateral_validator_script_hash = mock_script_hash(2)

  let (collateral_datum, collateral_input) = get_collateral_details()
  expect CollateralDatum {
    st_policy_id,
    st_asset_name,
    st_borrowed,
    loan_nft_pid,
    loan_nft_asset_name,
    collateral_rate_at_lending_precised,
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

  let previous_collateral_asset_amount = 15000000
  let updated_collateral_asset_amount =
    previous_collateral_asset_amount + (
      lovelace_of(user_balance_input.output.value) - lovelace_of(
        user_balance_output.value,
      )
    )
  let output_collateral_datum =
    CollateralDatum {
      st_policy_id,
      st_asset_name,
      st_borrowed,
      loan_nft_pid,
      loan_nft_asset_name,
      collateral_rate_at_lending_precised,
      collateral_asset,
      collateral_asset_amount: updated_collateral_asset_amount,
    }
  let collateral_output =
    Output {
      address: Address {
        payment_credential: Script(collateral_validator_script_hash),
        stake_credential: None,
      },
      value: from_lovelace(updated_collateral_asset_amount),
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
    unified_control_validator_hash,
    Some(deposit_datum),
    PartialWithdrawal,
    user_balance_input.output_reference,
    tx,
  ) && collateral_validator.spend(
    unified_control_validator_hash,
    Some(collateral_datum),
    IncreaseCollateral,
    collateral_input.output_reference,
    tx,
  )
}

test test_increase_other_asset_collateral() {
  let unified_control_validator_hash = mock_script_hash(1)
  let depositor_vkh = mock_pub_key_hash(0)
  let collateral_validator_script_hash = mock_script_hash(2)

  let loan_nfst_policy_id = mock_policy_id(0)

  let test_st_policy_id = mock_policy_id(0)
  let test_st_asset_name = st_stable_asset_name
  let collateral_asset_amount = 15000000
  let loan_nft_name = "BorrowNFT1"
  let hosky_pid = mock_policy_id(7)
  let hosky_an = "hosky"
  let the_collateral_asset =
    AssetType { is_stable: False, policy_id: hosky_pid, asset_name: hosky_an }
  let collateral_datum =
    CollateralDatum {
      st_policy_id: test_st_policy_id,
      st_asset_name: test_st_asset_name,
      st_borrowed: 12,
      loan_nft_pid: loan_nfst_policy_id,
      loan_nft_asset_name: loan_nft_name,
      collateral_rate_at_lending_precised: 1200000,
      collateral_asset: the_collateral_asset,
      collateral_asset_amount,
    }
  let collateral_input =
    Input {
      output_reference: mock_utxo_ref(0, 1),
      output: Output {
        address: Address {
          payment_credential: Script(collateral_validator_script_hash),
          stake_credential: None,
        },
        value: from_lovelace(collateral_asset_amount),
        datum: InlineDatum(collateral_datum),
        reference_script: None,
      },
    }

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
          assets.merge(
            from_asset(loan_nfst_policy_id, loan_nft_name, 1),
            from_asset(hosky_pid, hosky_an, 25000000),
          ),
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
        assets.merge(
          from_asset(loan_nfst_policy_id, loan_nft_name, 1),
          from_asset(hosky_pid, hosky_an, 16000000),
        ),
      ),
      datum: NoDatum,
      reference_script: None,
    }

  let previous_collateral_asset_amount = 15000000
  let updated_collateral_asset_amount =
    previous_collateral_asset_amount + (
      quantity_of(user_wallet_input.output.value, hosky_pid, hosky_an) - quantity_of(
        user_wallet_output.value,
        hosky_pid,
        hosky_an,
      )
    )
  let output_collateral_datum =
    CollateralDatum {
      st_policy_id: test_st_policy_id,
      st_asset_name: test_st_asset_name,
      st_borrowed: 12,
      loan_nft_pid: loan_nfst_policy_id,
      loan_nft_asset_name: loan_nft_name,
      collateral_rate_at_lending_precised: 1200000,
      collateral_asset: the_collateral_asset,
      collateral_asset_amount: updated_collateral_asset_amount,
    }
  let collateral_output =
    Output {
      address: Address {
        payment_credential: Script(collateral_validator_script_hash),
        stake_credential: None,
      },
      value: assets.merge(
        from_lovelace(2000000),
        from_asset(hosky_pid, hosky_an, updated_collateral_asset_amount),
      ),
      datum: InlineDatum(output_collateral_datum),
      reference_script: None,
    }

  let tx =
    Transaction {
      ..placeholder,
      inputs: [user_wallet_input, collateral_input],
      outputs: [user_wallet_output, collateral_output],
      extra_signatories: [depositor_vkh],
    }

  collateral_validator.spend(
    unified_control_validator_hash,
    Some(collateral_datum),
    IncreaseCollateral,
    collateral_input.output_reference,
    tx,
  )
}

test test_partial_repayment() {
  let unified_control_validator_hash = mock_script_hash(1)
  let depositor_vkh = mock_pub_key_hash(0)
  let collateral_validator_script_hash = mock_script_hash(2)
  let loan_token_burn_amount = 7

  let (collateral_datum, collateral_input) = get_collateral_details()
  expect CollateralDatum {
    st_policy_id,
    st_asset_name,
    st_borrowed: previous_loan_amount,
    loan_nft_pid,
    loan_nft_asset_name,
    collateral_rate_at_lending_precised,
    collateral_asset,
    collateral_asset_amount,
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
          assets.merge(
            from_asset(loan_nft_pid, loan_nft_asset_name, 1),
            from_asset(st_policy_id, st_asset_name, 30),
          ),
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
        assets.merge(
          from_asset(loan_nft_pid, loan_nft_asset_name, 1),
          from_asset(st_policy_id, st_asset_name, 23),
        ),
      ),
      datum: NoDatum,
      reference_script: None,
    }

  let output_collateral_datum =
    CollateralDatum {
      st_policy_id,
      st_asset_name,
      st_borrowed: previous_loan_amount - loan_token_burn_amount,
      loan_nft_pid,
      loan_nft_asset_name,
      collateral_rate_at_lending_precised,
      collateral_asset,
      collateral_asset_amount,
    }
  let collateral_output =
    Output {
      address: Address {
        payment_credential: Script(collateral_validator_script_hash),
        stake_credential: None,
      },
      value: collateral_input.output.value,
      datum: InlineDatum(output_collateral_datum),
      reference_script: None,
    }

  let mint =
    from_asset(st_policy_id, st_asset_name, -1 * loan_token_burn_amount)

  let tx =
    Transaction {
      ..placeholder,
      inputs: [user_wallet_input, collateral_input],
      outputs: [user_wallet_output, collateral_output],
      mint: mint,
    }

  collateral_validator.spend(
    unified_control_validator_hash,
    Some(collateral_datum),
    PartialRepayment,
    collateral_input.output_reference,
    tx,
  )
}
