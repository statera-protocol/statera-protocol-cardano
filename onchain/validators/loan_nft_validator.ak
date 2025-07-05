use aiken/collection/dict
use aiken/collection/list
use aiken/crypto.{ScriptHash}
use aiken/primitive/bytearray
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
  identifier_token_name, precision_factor, st_oracle_asset_name,
  st_pparams_asset_name, st_stable_asset_name,
}
use statera/datums.{
  CollateralDatum, CollateralValidatorDatum, DepositorDatum, OracleDatum,
  ProtocolParametersDatum,
}
use statera/test_fns.{get_protocol_parameters_ref}
use statera/types.{AssetRate, AssetType}
use statera/utils.{
  calculate_by_percentage, find_oracle_rate, find_ucv_ref_input,
  get_user_asset_amt_in_out,
}

pub type Action {
  BorrowLoan
  RepayLoan
}

validator loan_nft_validator(
  borrow_utxo: OutputReference,
  collateral_validator_hash: ScriptHash,
  unified_control_validator_hash: ScriptHash,
) {
  mint(redeemer: Action, policy_id: PolicyId, self: Transaction) {
    let Transaction { inputs, outputs, mint, reference_inputs, .. } = self

    when redeemer is {
      BorrowLoan ->
        validate_mint_borrow_nft(
          mint,
          policy_id,
          inputs,
          collateral_validator_hash,
          unified_control_validator_hash,
          reference_inputs,
          outputs,
          borrow_utxo,
        )
      RepayLoan ->
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
  unified_control_validator_hash: ScriptHash,
  reference_inputs: List<Input>,
  outputs: List<Output>,
  borrow_utxo: OutputReference,
) {
  // find collateral output going to collateral validator script and make sure it's datum is of type "CollateralDatum"
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
    st_policy_id,
    st_asset_name,
    st_borrowed,
    loan_nft_pid,
    collateral_rate_at_lending_precised,
    collateral_asset,
    collateral_asset_amount,
    ..
  } = collateral_output_datum

  let AssetType {
    policy_id: collateral_asset_pid,
    asset_name: collateral_asset_an,
    ..
  } = collateral_asset

  // value of loan amount (ada or other token) in the collateral output utxo must be equal to the amount info in it's datum
  let is_borrow_amount_valid =
    if collateral_asset_pid == "" {
      lovelace_of(collateral_output.value) == collateral_asset_amount
    } else {
      quantity_of(
        collateral_output.value,
        collateral_asset_pid,
        collateral_asset_an,
      ) == collateral_asset_amount
    }

  // loan nft mint
  expect [Pair(nft_asset_name, nft_quantity)] =
    mint |> assets.tokens(policy_id) |> dict.to_pairs

  // loan tokens (statera) mint
  expect [Pair(_, mint_loan_quantity)] =
    mint |> assets.tokens(st_policy_id) |> dict.to_pairs
  let is_loan_mint_quantity_valid = mint_loan_quantity == st_borrowed

  expect Some(borrow_input) = find_input(inputs, borrow_utxo)
  // if collateral asset is ADA, expect user deposit input from collateral validator
  let (is_borrow_input_change_returned, borrow_output_st) =
    if collateral_asset_pid == "" {
      validate_ada_collateral(
        borrow_input,
        collateral_validator_hash,
        collateral_asset_amount,
        policy_id,
        nft_asset_name,
        st_policy_id,
        st_asset_name,
        outputs,
      )
    } else {
      validate_other_assets_collateral(
        borrow_input,
        collateral_asset_amount,
        policy_id,
        nft_asset_name,
        st_policy_id,
        st_asset_name,
        inputs,
        outputs,
        collateral_asset_pid,
        collateral_asset_an,
      )
    }

  // amount of staterites going to the user's address as loan should be the same as the amount of staterites
  // in the collateral output datum
  let is_st_borrowed_valid_in_datum = borrow_output_st == st_borrowed

  // Loan nft policy id must be valid in collateral datum
  let loan_nft_pid_valid_in_datum = loan_nft_pid == policy_id

  // Can mint only one loan NFT
  let loan_nft_mint = nft_quantity == 1

  // stable coin asset name must be "staterites"
  let st_asset_name_valid = st_asset_name == st_stable_asset_name

  // trace @"is_borrow_amount_valid": is_borrow_amount_valid, True
  // trace @"is_borrow_input_change_returned": is_borrow_input_change_returned, True
  // trace @"is_loan_mint_quantity_valid": is_loan_mint_quantity_valid, True
  // trace @"is_st_borrowed_valid_in_datum": is_st_borrowed_valid_in_datum, True
  // trace @"loan_nft_pid_valid_in_datum": loan_nft_pid_valid_in_datum, True
  // trace @"loan_nft_mint": loan_nft_mint, True
  // trace @"st_asset_name_valid": st_asset_name_valid, True
  and {
    validate_protocol_parameters(
      reference_inputs,
      unified_control_validator_hash,
      collateral_rate_at_lending_precised,
      collateral_asset_amount,
      borrow_output_st,
      collateral_asset_pid,
      collateral_asset_an,
      collateral_asset,
    )?,
    is_borrow_amount_valid?,
    is_borrow_input_change_returned?,
    is_loan_mint_quantity_valid?,
    is_st_borrowed_valid_in_datum?,
    loan_nft_pid_valid_in_datum?,
    loan_nft_mint?,
    st_asset_name_valid?,
  }
}

fn validate_protocol_parameters(
  reference_inputs: List<Input>,
  unified_control_validator_hash: ScriptHash,
  collateral_rate_at_lending_precised: Int,
  collateral_asset_amount: Int,
  borrow_output_st: Int,
  collateral_asset_pid: PolicyId,
  collateral_asset_an: AssetName,
  collateral_asset: AssetType,
) {
  // trace @"in validate_protocol_parameters()"

  expect Some(protocol_parameters_ref) =
    find_ucv_ref_input(
      reference_inputs,
      unified_control_validator_hash,
      st_pparams_asset_name,
    )

  expect InlineDatum(protocol_parameters_datum) =
    protocol_parameters_ref.output.datum

  expect ProtocolParametersDatum {
    loan_to_value_ratio,
    min_loan_amount,
    collateral_assets,
    ..
  } = protocol_parameters_datum

  // Make sure collateral asset is allowed
  expect list.has(collateral_assets, collateral_asset)

  // trace @"before is_col_amount_and_rate_valid"
  let is_col_amount_and_rate_valid = {
    let (asset_in_usd_precised, oracle_asset_st_rate) =
      get_asset_usd_value(
        unified_control_validator_hash,
        reference_inputs,
        collateral_asset_amount,
        collateral_asset_pid,
        collateral_asset_an,
      )

    let ltv_asset_in_usd_precised =
      calculate_by_percentage(asset_in_usd_precised, 100, loan_to_value_ratio)

    and {
      // Both operand below are in product of the precision_factor
      // amount of loan user is taking must not be greater than the loan to value ratio
      (borrow_output_st * precision_factor <= ltv_asset_in_usd_precised)?,
      trace @"bost...": borrow_output_st * precision_factor, ltv_asset_in_usd_precised
      // Oracle usd rate is same as the one in datum
      (oracle_asset_st_rate == collateral_rate_at_lending_precised)?,
    }
  }
  trace @"after is_col_amount_and_rate_valid"

  let is_loan_amount_valid = borrow_output_st >= min_loan_amount

  trace @"is_col_amount_and_rate_valid": is_col_amount_and_rate_valid, True
  trace @"is_loan_amount_valid": is_loan_amount_valid, True

  and {
    is_col_amount_and_rate_valid?,
    is_loan_amount_valid?,
  }
}

fn get_asset_usd_value(
  unified_control_validator_hash: ScriptHash,
  reference_inputs: List<Input>,
  collateral_asset_amount: Int,
  collateral_asset_pid: PolicyId,
  collateral_asset_an: AssetName,
) {
  expect Some(oracle_ref) =
    find_ucv_ref_input(
      reference_inputs,
      unified_control_validator_hash,
      st_oracle_asset_name,
    )

  // trace @"in get_expected_col_asset_amount immediately after expecting oracle_ref"
  expect Some(oracle_rate) =
    find_oracle_rate(oracle_ref, collateral_asset_pid, collateral_asset_an)

  // trace @"in get_expected_col_asset_amount immediately after expecting oracle_rate"
  let AssetRate { num, denum, .. } = oracle_rate

  // how many of the asset give one staterite (precised)
  let oracle_asset_st_rate = num * precision_factor / denum

  // trace @"oracle_asset_st_rate": oracle_asset_st_rate
  // trace @"oracle_asset_st_rate": oracle_asset_st_rate
  let asset_in_usd_precised = collateral_asset_amount * oracle_asset_st_rate

  // trace @"asset_in_usd_precised": asset_in_usd_precised
  // trace @"collateral_asset_amount": collateral_asset_amount
  // trace @"expected_borrow_asset_amount": expected_borrow_asset_amount
  // trace @"borrow_output_st": borrow_output_st
  (asset_in_usd_precised, oracle_asset_st_rate)
}

fn validate_ada_collateral(
  borrow_input: Input,
  collateral_validator_hash: ScriptHash,
  collateral_asset_amount: Int,
  policy_id: PolicyId,
  nft_asset_name: AssetName,
  st_policy_id: PolicyId,
  st_asset_name: AssetName,
  outputs: List<Output>,
) {
  // find user ada deposit utxo, get it's datum and the depositor's verification key hash
  // For ADA collateral, utxo must be from the user's protocol balance
  expect
    borrow_input.output.address.payment_credential == Script(
      collateral_validator_hash,
    )
  expect InlineDatum(borrow_input_datum) = borrow_input.output.datum
  expect DepositorDatum { depositor_vkh } = borrow_input_datum

  // find output going back to the user deposit account
  expect Some(change_output) =
    list.find(
      outputs,
      fn(output) {
        when output.datum is {
          InlineDatum(change_output_datum) ->
            if change_output_datum
            is DepositorDatum {
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
  // Check that the change of borrow input goes back as user deposit balance
  let is_borrow_input_change_returned =
    lovelace_of(borrow_input.output.value) - collateral_asset_amount == lovelace_of(
      change_output.value,
    )

  // find a borrow output that has the loan NFT is going to the user wallet address
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

  // Get the amount of st tokens going to the user's wallet
  let borrow_output_st =
    quantity_of(borrow_output.value, st_policy_id, st_asset_name)

  (is_borrow_input_change_returned, borrow_output_st)
}

fn validate_other_assets_collateral(
  borrow_input: Input,
  collateral_asset_amount: Int,
  policy_id: PolicyId,
  nft_asset_name: AssetName,
  st_policy_id: PolicyId,
  st_asset_name: AssetName,
  inputs: List<Input>,
  outputs: List<Output>,
  collateral_asset_pid: PolicyId,
  collateral_asset_an: AssetName,
) {
  // For non-ADA collaterals utxo must be from user's wallet
  expect VerificationKey(user_vkh) =
    borrow_input.output.address.payment_credential

  let (user_wallet_total_col_asset_input, user_wallet_total_col_asset_output) =
    get_user_asset_amt_in_out(
      inputs,
      outputs,
      user_vkh,
      collateral_asset_pid,
      collateral_asset_an,
    )

  // Check that the change of borrow input goes back to user's wallet
  let is_borrow_input_change_returned =
    user_wallet_total_col_asset_input - collateral_asset_amount == user_wallet_total_col_asset_output

  // find a borrow output that has the loan NFT and is going to the user wallet address
  expect Some(borrow_output) =
    outputs
      |> list.find(
          fn(output) {
            and {
              output.address.payment_credential == VerificationKey(user_vkh),
              quantity_of(output.value, policy_id, nft_asset_name) == 1,
            }
          },
        )

  // Get the amount of st tokens going to the user's wallet
  let borrow_output_st =
    quantity_of(borrow_output.value, st_policy_id, st_asset_name)

  (is_borrow_input_change_returned, borrow_output_st)
}

fn validate_burn_borrow_nft(
  inputs: List<Input>,
  outputs: List<Output>,
  mint: Value,
  collateral_validator_hash: ScriptHash,
) {
  // Find an input stored on the collateral validator, with the collateral datum
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
              if input_datum
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

  expect InlineDatum(collateral_input_datum) = collateral_input.output.datum

  expect CollateralDatum {
    st_policy_id,
    st_asset_name,
    st_borrowed,
    loan_nft_pid,
    loan_nft_asset_name,
    collateral_asset_amount,
    collateral_asset,
    ..
  } = collateral_input_datum

  let AssetType { policy_id: collateral_asset_pid, .. } = collateral_asset

  // loan nft mint
  expect [Pair(loan_nft_name, quantity)] =
    mint |> assets.tokens(loan_nft_pid) |> dict.to_pairs

  // loan nft must be burned and it's asset name must correspond to what is in the collateral utxo datum
  let is_loan_nft_burned = and {
      (quantity == -1)?,
      (loan_nft_asset_name == loan_nft_name)?,
    }

  let is_refund_assets_valid =
    if collateral_asset_pid == "" {
      validate_user_ada_input_output(
        inputs,
        outputs,
        collateral_validator_hash,
        loan_nft_pid,
        loan_nft_asset_name,
        st_policy_id,
        st_asset_name,
        collateral_asset_amount,
        st_borrowed,
      )
    } else {
      validate_user_other_asset_input_output(
        inputs,
        outputs,
        loan_nft_pid,
        loan_nft_asset_name,
        st_policy_id,
        st_asset_name,
        collateral_asset,
        collateral_asset_amount,
        st_borrowed,
      )
    }

  expect [Pair(_, refund_mint_quantity)] =
    mint |> assets.tokens(st_policy_id) |> dict.to_pairs
  let is_refund_amount_burned = refund_mint_quantity == -st_borrowed

  and {
    is_loan_nft_burned?,
    is_refund_amount_burned?,
    is_refund_assets_valid?,
  }
}

fn validate_user_ada_input_output(
  inputs: List<Input>,
  outputs: List<Output>,
  collateral_validator_hash: ScriptHash,
  loan_nft_pid: PolicyId,
  loan_nft_name: AssetName,
  st_policy_id: PolicyId,
  st_asset_name: AssetName,
  collateral_asset_amount: Int,
  st_borrowed: Int,
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

  // Find the loan NFT; make sure the loan NFT provider is the one whose whose balance will be updated
  expect Some(_loan_nft_refunder_input) =
    inputs
      |> list.find(
          fn(input) {
            and {
              (input.output.address.payment_credential == VerificationKey(
                depositor_vkh,
              ))?,
              ((
                input.output.value |> quantity_of(loan_nft_pid, loan_nft_name)
              ) == 1)?,
            }
          },
        )

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

  let (user_wallet_total_st_in, user_wallet_total_st_out) =
    get_user_asset_amt_in_out(
      inputs,
      outputs,
      depositor_vkh,
      st_policy_id,
      st_asset_name,
    )

  // Make sure claimed collateral is going back to user who provided loan NFT
  let is_collateral_going_back_to_refunder =
    lovelace_of(user_balance_input.output.value) + collateral_asset_amount == lovelace_of(
      user_balance_output.value,
    )
  // Make sure user returns exact amount of staterites borrowed
  let is_st_amount_valid =
    user_wallet_total_st_in - st_borrowed == user_wallet_total_st_out

  and {
    is_collateral_going_back_to_refunder?,
    is_st_amount_valid?,
  }
}

fn validate_user_other_asset_input_output(
  inputs: List<Input>,
  outputs: List<Output>,
  loan_nft_pid: PolicyId,
  loan_nft_name: AssetName,
  st_policy_id: PolicyId,
  st_asset_name: AssetName,
  collateral_asset: AssetType,
  collateral_asset_amount: Int,
  st_borrowed: Int,
) {
  // Find user input with loan NFT
  expect Some(loan_nft_input) =
    inputs
      |> list.find(
          fn(input) {
            ( input.output.value |> quantity_of(loan_nft_pid, loan_nft_name) ) == 1
          },
        )
  expect VerificationKey(user_vkh) =
    loan_nft_input.output.address.payment_credential

  let AssetType {
    policy_id: collateral_asset_pid,
    asset_name: collateral_asset_an,
    ..
  } = collateral_asset

  let (user_wallet_total_col_in, user_wallet_total_col_out) =
    get_user_asset_amt_in_out(
      inputs,
      outputs,
      user_vkh,
      collateral_asset_pid,
      collateral_asset_an,
    )
  let (user_wallet_total_st_in, user_wallet_total_st_out) =
    get_user_asset_amt_in_out(
      inputs,
      outputs,
      user_vkh,
      st_policy_id,
      st_asset_name,
    )

  // Make sure claimed collateral is going back to user who provided loan NFT
  let is_collateral_going_back_to_refunder =
    user_wallet_total_col_in + collateral_asset_amount == user_wallet_total_col_out
  // Make sure user returns exact amount of staterites borrowed
  let is_st_amount_valid =
    user_wallet_total_st_in - st_borrowed == user_wallet_total_st_out

  and {
    is_collateral_going_back_to_refunder?,
    is_st_amount_valid?,
  }
}

// Tests
fn get_oracle_ref(unit: ByteArray, num: Int, denum: Int) {
  let unified_control_validator_hash = mock_script_hash(1)

  let oracle_outref = mock_utxo_ref(0, 2)
  let oracle_ref =
    Input {
      output_reference: oracle_outref,
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
          OracleDatum { oracle_rates: [AssetRate { unit, num, denum }] },
        ),
        reference_script: None,
      },
    }

  oracle_ref
}

test test_borrow_with_ada_collateral() {
  let unified_control_validator_hash = mock_script_hash(1)
  let collateral_validator_script_hash = mock_script_hash(2)
  let borrow_lovelace_amount = 21600000
  let borrow_outref = mock_utxo_ref(0, 0)
  let borrow_key_hash = mock_pub_key_hash(0)
  let borrower_lovelace_balance = 30000000
  let borrow_input =
    Input {
      output_reference: borrow_outref,
      output: Output {
        address: Address {
          payment_credential: Script(collateral_validator_script_hash),
          stake_credential: None,
        },
        value: from_lovelace(borrower_lovelace_balance),
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
      value: from_lovelace(borrower_lovelace_balance - borrow_lovelace_amount),
      datum: InlineDatum(DepositorDatum { depositor_vkh: borrow_key_hash }),
      reference_script: None,
    }

  let loan_nft_policy_id = mock_policy_id(1)
  let test_st_policy_id = mock_policy_id(9)
  let collateral_asset_amount = borrow_lovelace_amount
  let loan_nft_name = "BorrowNFT1"
  let collateral_validator_output =
    Output {
      address: Address {
        payment_credential: Script(collateral_validator_script_hash),
        stake_credential: None,
      },
      value: from_lovelace(collateral_asset_amount),
      datum: InlineDatum(
        CollateralDatum {
          st_policy_id: test_st_policy_id,
          st_asset_name: st_stable_asset_name,
          st_borrowed: 12_000_000,
          loan_nft_pid: loan_nft_policy_id,
          loan_nft_asset_name: loan_nft_name,
          // 1.2 lovelaces (per staterites)
          collateral_rate_at_lending_precised: 12 * precision_factor / 10,
          collateral_asset: AssetType {
            is_stable: False,
            policy_id: "",
            asset_name: "lovelace",
          },
          collateral_asset_amount,
        },
      ),
      reference_script: None,
    }

  let borrow_output =
    Output {
      address: Address {
        payment_credential: VerificationKey(borrow_key_hash),
        stake_credential: None,
      },
      value: assets.merge(
        from_asset(test_st_policy_id, st_stable_asset_name, 12_000_000),
        from_asset(loan_nft_policy_id, loan_nft_name, 1),
      ),
      datum: NoDatum,
      reference_script: None,
    }

  let mint =
    from_asset_list(
      [
        Pair(loan_nft_policy_id, [Pair(loan_nft_name, 1)]),
        Pair(test_st_policy_id, [Pair(st_stable_asset_name, 12_000_000)]),
      ],
    )

  let protocol_parameters_ref = get_protocol_parameters_ref()
  let oracle_ref = get_oracle_ref("lovelace", 24_000_000, 20_000_000)

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
    unified_control_validator_hash,
    BorrowLoan,
    loan_nft_policy_id,
    tx,
  )
}

test test_borrow_with_hosky_collateral() {
  let unified_control_validator_hash = mock_script_hash(1)
  let collateral_validator_script_hash = mock_script_hash(2)
  let borrow_hosky_amount_100_percent = 11600000000
  let borrow_hosky_amount = 11600000000 * 150 / 100
  // overcollateralized collateral
  let borrow_outref = mock_utxo_ref(0, 0)
  let borrow_key_hash = mock_pub_key_hash(0)
  let borrower_hosky_balance = 40000000000
  let hosky_pid = mock_policy_id(7)
  let hosky_an = "hosky"
  let hosky_unit = bytearray.concat(hosky_pid, hosky_an)
  let hosky_rate_num = 20_000_000
  let hosky_rate_denum = 1_000_000
  let st_can_be_borrowed =
    borrow_hosky_amount_100_percent / ( hosky_rate_num / hosky_rate_denum )

  // 20 hosky per staterites
  let borrow_input =
    Input {
      output_reference: borrow_outref,
      output: Output {
        address: Address {
          payment_credential: VerificationKey(borrow_key_hash),
          stake_credential: None,
        },
        value: assets.merge(
          from_lovelace(2000000),
          from_asset(hosky_pid, hosky_an, borrower_hosky_balance),
        ),
        datum: NoDatum,
        reference_script: None,
      },
    }

  let loan_nft_policy_id = mock_policy_id(1)
  let test_st_policy_id = mock_policy_id(9)
  let collateral_asset_amount = borrow_hosky_amount
  let loan_nft_name = "BorrowNFT1"
  let collateral_validator_output =
    Output {
      address: Address {
        payment_credential: Script(collateral_validator_script_hash),
        stake_credential: None,
      },
      value: assets.merge(
        from_lovelace(2000000),
        from_asset(hosky_pid, hosky_an, collateral_asset_amount),
      ),
      datum: InlineDatum(
        CollateralDatum {
          st_policy_id: test_st_policy_id,
          st_asset_name: st_stable_asset_name,
          st_borrowed: st_can_be_borrowed,
          loan_nft_pid: loan_nft_policy_id,
          loan_nft_asset_name: loan_nft_name,
          collateral_rate_at_lending_precised: hosky_rate_num * precision_factor / hosky_rate_denum,
          collateral_asset: AssetType {
            is_stable: False,
            policy_id: hosky_pid,
            asset_name: hosky_an,
          },
          collateral_asset_amount,
        },
      ),
      reference_script: None,
    }

  let borrow_output =
    Output {
      address: Address {
        payment_credential: VerificationKey(borrow_key_hash),
        stake_credential: None,
      },
      value: assets.merge(
        assets.merge(
          assets.merge(
            from_lovelace(2000000),
            from_asset(
              hosky_pid,
              hosky_an,
              borrower_hosky_balance - borrow_hosky_amount,
            ),
          ),
          from_asset(
            test_st_policy_id,
            st_stable_asset_name,
            st_can_be_borrowed,
          ),
        ),
        from_asset(loan_nft_policy_id, loan_nft_name, 1),
      ),
      datum: NoDatum,
      reference_script: None,
    }

  let mint =
    from_asset_list(
      [
        Pair(loan_nft_policy_id, [Pair(loan_nft_name, 1)]),
        Pair(
          test_st_policy_id,
          [Pair(st_stable_asset_name, st_can_be_borrowed)],
        ),
      ],
    )

  let protocol_parameters_ref = get_protocol_parameters_ref()
  let oracle_ref = get_oracle_ref(hosky_unit, hosky_rate_num, hosky_rate_denum)

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
    unified_control_validator_hash,
    BorrowLoan,
    loan_nft_policy_id,
    tx,
  )
}

test test_refund_to_redeem_ada_collateral() {
  let unified_control_validator_hash = mock_script_hash(1)
  let loan_nft_policy_id = mock_policy_id(0)
  let borrow_outref = mock_utxo_ref(0, 0)

  let collateral_validator_script_hash = mock_script_hash(2)
  let test_st_policy_id = mock_policy_id(9)
  let collateral_asset_amount = 21600000
  let loan_nft_name = "BorrowNFT1"
  let collateral_input =
    Input {
      output_reference: mock_utxo_ref(0, 1),
      output: Output {
        address: Address {
          payment_credential: Script(collateral_validator_script_hash),
          stake_credential: None,
        },
        value: from_lovelace(collateral_asset_amount),
        datum: InlineDatum(
          CollateralDatum {
            st_policy_id: test_st_policy_id,
            st_asset_name: st_stable_asset_name,
            st_borrowed: 12_000_000,
            loan_nft_pid: loan_nft_policy_id,
            loan_nft_asset_name: loan_nft_name,
            // $1.2 (per ADA)
            collateral_rate_at_lending_precised: 12 * precision_factor / 10,
            collateral_asset: AssetType {
              is_stable: False,
              policy_id: "",
              asset_name: "lovelace",
            },
            collateral_asset_amount,
          },
        ),
        reference_script: None,
      },
    }

  let refunder_outref = mock_utxo_ref(0, 2)
  let refunder_key_hash = mock_pub_key_hash(0)
  let loan_refund_value =
    from_asset(test_st_policy_id, st_stable_asset_name, 12_000_000)
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
        from_lovelace(4000000 + collateral_asset_amount),
        from_asset(collateral_validator_script_hash, identifier_token_name, 1),
      ),
      datum: InlineDatum(user_balance_datum),
      reference_script: None,
    }

  let mint =
    assets.merge(
      from_asset(loan_nft_policy_id, loan_nft_name, -1),
      from_asset(test_st_policy_id, st_stable_asset_name, -12_000_000),
    )

  let tx =
    Transaction {
      ..placeholder,
      inputs: [collateral_input, refunder_input, user_balance_input],
      outputs: [user_balance_output],
      mint: mint,
    }

  loan_nft_validator.mint(
    borrow_outref,
    collateral_validator_script_hash,
    unified_control_validator_hash,
    RepayLoan,
    loan_nft_policy_id,
    tx,
  )
}

test test_refund_to_redeem_hosky_collateral() {
  let unified_control_validator_hash = mock_script_hash(1)
  let collateral_validator_script_hash = mock_script_hash(2)
  let borrow_hosky_amount_100_percent = 11600000000
  let borrow_hosky_amount = 11600000000 * 150 / 100
  // overcollateralized collateral
  let borrow_outref = mock_utxo_ref(0, 0)
  let borrow_key_hash = mock_pub_key_hash(0)
  let borrower_hosky_balance = 40000000000
  let hosky_pid = mock_policy_id(7)
  let hosky_an = "hosky"
  let hosky_rate_num = 20_000_000
  let hosky_rate_denum = 1_000_000
  let st_can_be_borrowed =
    borrow_hosky_amount_100_percent / ( hosky_rate_num / hosky_rate_denum )
  // 20 hosky per staterites
  let test_st_policy_id = mock_policy_id(9)
  let loan_nft_policy_id = mock_policy_id(1)
  let loan_nft_name = "BorrowNFT1"

  let refunder_input =
    Input {
      output_reference: borrow_outref,
      output: Output {
        address: Address {
          payment_credential: VerificationKey(borrow_key_hash),
          stake_credential: None,
        },
        value: assets.merge(
          assets.merge(
            assets.merge(
              from_lovelace(2000000),
              from_asset(
                hosky_pid,
                hosky_an,
                borrower_hosky_balance - borrow_hosky_amount,
              ),
            ),
            from_asset(
              test_st_policy_id,
              st_stable_asset_name,
              st_can_be_borrowed,
            ),
          ),
          from_asset(loan_nft_policy_id, loan_nft_name, 1),
        ),
        datum: NoDatum,
        reference_script: None,
      },
    }

  let collateral_asset_amount = borrow_hosky_amount
  let collateral_validator_input =
    Input {
      output_reference: mock_utxo_ref(0, 1),
      output: Output {
        address: Address {
          payment_credential: Script(collateral_validator_script_hash),
          stake_credential: None,
        },
        value: assets.merge(
          from_lovelace(2000000),
          from_asset(hosky_pid, hosky_an, collateral_asset_amount),
        ),
        datum: InlineDatum(
          CollateralDatum {
            st_policy_id: test_st_policy_id,
            st_asset_name: st_stable_asset_name,
            st_borrowed: st_can_be_borrowed,
            loan_nft_pid: loan_nft_policy_id,
            loan_nft_asset_name: loan_nft_name,
            collateral_rate_at_lending_precised: hosky_rate_num * precision_factor / hosky_rate_denum,
            collateral_asset: AssetType {
              is_stable: False,
              policy_id: hosky_pid,
              asset_name: hosky_an,
            },
            collateral_asset_amount,
          },
        ),
        reference_script: None,
      },
    }

  let refunder_output =
    Output {
      address: Address {
        payment_credential: VerificationKey(borrow_key_hash),
        stake_credential: None,
      },
      value: assets.merge(
        from_lovelace(2000000),
        from_asset(hosky_pid, hosky_an, borrower_hosky_balance),
      ),
      datum: NoDatum,
      reference_script: None,
    }

  let mint =
    from_asset_list(
      [
        Pair(loan_nft_policy_id, [Pair(loan_nft_name, -1)]),
        Pair(
          test_st_policy_id,
          [Pair(st_stable_asset_name, -st_can_be_borrowed)],
        ),
      ],
    )

  let tx =
    Transaction {
      ..placeholder,
      inputs: [refunder_input, collateral_validator_input],
      outputs: [refunder_output],
      mint: mint,
    }

  loan_nft_validator.mint(
    borrow_outref,
    collateral_validator_script_hash,
    unified_control_validator_hash,
    RepayLoan,
    loan_nft_policy_id,
    tx,
  )
}
