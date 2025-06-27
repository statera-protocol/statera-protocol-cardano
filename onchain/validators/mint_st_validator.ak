use aiken/collection/dict
use aiken/collection/list
use aiken/collection/pairs
use aiken/crypto.{ScriptHash}
use cardano/address.{Address, Credential, Script}
use cardano/assets.{PolicyId, Value, from_asset, from_lovelace}
use cardano/transaction.{InlineDatum, Input, Output, Transaction, placeholder}
use mocktail/virgin_key_hash.{mock_policy_id, mock_script_hash}
use mocktail/virgin_output_reference.{mock_utxo_ref}
use statera/constants.{precision_factor, st_stable_asset_name}
use statera/datums.{CollateralDatum, CollateralValidatorDatum}
use statera/types.{
  AssetType, GetLoan, MintStRedeemer, PartialRepay, RepayLoan, Swap,
}

validator mint_st_validator(
  collateral_validator_hash: ScriptHash,
  pool_batching_cred: Credential,
) {
  mint(redeemer: MintStRedeemer, policy_id: PolicyId, self: Transaction) {
    let Transaction { inputs, outputs, mint, withdrawals, .. } = self

    when redeemer is {
      GetLoan ->
        validate_get_loan(collateral_validator_hash, outputs, mint, policy_id)
      RepayLoan | PartialRepay ->
        validate_repay_and_partial_repay_loan(
          collateral_validator_hash,
          inputs,
          outputs,
          mint,
          policy_id,
          redeemer,
        )
      Swap -> pairs.has_key(withdrawals, pool_batching_cred)?
    }
  }

  else(_) {
    fail
  }
}

fn validate_get_loan(
  collateral_validator_hash: ScriptHash,
  outputs: List<Output>,
  mint: Value,
  policy_id: PolicyId,
) {
  let collateral_outputs =
    filter_collateral_outputs(outputs, collateral_validator_hash)

  // Must be one collateral_output
  expect list.length(collateral_outputs) == 1

  expect Some(collateral_output) = list.at(collateral_outputs, 0)

  expect InlineDatum(collateral_output_datum) = collateral_output.datum

  expect CollateralDatum { st_policy_id, st_asset_name, st_borrowed, .. } =
    collateral_output_datum

  expect [Pair(name, quantity)] =
    mint |> assets.tokens(policy_id) |> dict.to_pairs

  let is_loan_pool_and_pid_valid = policy_id == st_policy_id
  let is_loan_asset_name_valid = and {
      name == st_asset_name,
      name == st_stable_asset_name,
    }
  let is_loan_mint_quantity_valid = quantity == st_borrowed

  and {
    is_loan_pool_and_pid_valid?,
    is_loan_asset_name_valid?,
    is_loan_mint_quantity_valid?,
  }
}

fn validate_repay_and_partial_repay_loan(
  collateral_validator_hash: ScriptHash,
  inputs: List<Input>,
  outputs: List<Output>,
  mint: Value,
  policy_id: PolicyId,
  redeemer: MintStRedeemer,
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
  expect CollateralDatum { st_borrowed, .. } = collateral_input_datum

  expect [Pair(_, quantity)] = mint |> assets.tokens(policy_id) |> dict.to_pairs

  when redeemer is {
    RepayLoan -> (quantity == -st_borrowed)?
    PartialRepay -> {
      let collateral_outputs =
        filter_collateral_outputs(outputs, collateral_validator_hash)

      // Must be one collateral_output
      expect list.length(collateral_outputs) == 1

      expect Some(collateral_output) = list.at(collateral_outputs, 0)
      expect InlineDatum(collateral_output_datum) = collateral_output.datum
      expect CollateralDatum { st_borrowed: output_st_borrowed, .. } =
        collateral_output_datum

      (output_st_borrowed == st_borrowed - -1 * quantity)?
    }
    _ -> False
  }
}

fn filter_collateral_outputs(
  outputs: List<Output>,
  collateral_validator_hash: ScriptHash,
) {
  list.filter(
    outputs,
    fn(output) {
      and {
        (output.address.payment_credential == Script(collateral_validator_hash))?,
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
}

// Tests
test test_mint_loan_tokens() {
  let pool_batching_sh = Script(mock_script_hash(5))

  let loan_nft_policy_id = mock_policy_id(1)
  let collateral_validator_script_hash = mock_script_hash(2)
  let test_st_policy_id = mock_script_hash(3)
  let collateral_asset_amount = 21600000
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

  let mint = from_asset(test_st_policy_id, st_stable_asset_name, 12_000_000)

  let tx =
    Transaction {
      ..placeholder,
      outputs: [collateral_validator_output],
      mint: mint,
    }

  mint_st_validator.mint(
    collateral_validator_script_hash,
    pool_batching_sh,
    GetLoan,
    test_st_policy_id,
    tx,
  )
}

test test_burn_loan_tokens() {
  let pool_batching_sh = Script(mock_script_hash(5))

  let loan_nft_policy_id = mock_policy_id(1)
  let collateral_validator_script_hash = mock_script_hash(2)
  let test_st_policy_id = mock_script_hash(3)
  let collateral_asset_amount = 15000000
  let loan_nft_name = "BorrowNFT1"
  let collateral_validator_input =
    Input {
      output_reference: mock_utxo_ref(0, 0),
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

  let mint = from_asset(test_st_policy_id, st_stable_asset_name, -12_000_000)

  let tx =
    Transaction {
      ..placeholder,
      inputs: [collateral_validator_input],
      mint: mint,
    }

  mint_st_validator.mint(
    collateral_validator_script_hash,
    pool_batching_sh,
    RepayLoan,
    test_st_policy_id,
    tx,
  )
}

test test_partial_repay_burn() {
  let pool_batching_sh = Script(mock_script_hash(5))

  let loan_token_burn_amount = 6_000_000
  let loan_nft_policy_id = mock_policy_id(1)
  let collateral_validator_script_hash = mock_script_hash(2)
  let test_st_policy_id = mock_script_hash(3)
  let collateral_asset_amount = 15000000
  let loan_nft_name = "BorrowNFT1"
  let collateral_validator_input =
    Input {
      output_reference: mock_utxo_ref(0, 0),
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

  let output_collateral_datum =
    CollateralDatum {
      st_policy_id: test_st_policy_id,
      st_asset_name: st_stable_asset_name,
      st_borrowed: 12_000_000 - loan_token_burn_amount,
      loan_nft_pid: loan_nft_policy_id,
      loan_nft_asset_name: loan_nft_name,
      collateral_rate_at_lending_precised: 12 * precision_factor / 10,
      collateral_asset: AssetType {
        is_stable: False,
        policy_id: "",
        asset_name: "lovelace",
      },
      collateral_asset_amount,
    }
  let collateral_output =
    Output {
      address: Address {
        payment_credential: Script(collateral_validator_script_hash),
        stake_credential: None,
      },
      value: from_lovelace(collateral_asset_amount),
      datum: InlineDatum(output_collateral_datum),
      reference_script: None,
    }

  let mint =
    from_asset(test_st_policy_id, st_stable_asset_name, -loan_token_burn_amount)

  let tx =
    Transaction {
      ..placeholder,
      inputs: [collateral_validator_input],
      outputs: [collateral_output],
      mint: mint,
    }

  mint_st_validator.mint(
    collateral_validator_script_hash,
    pool_batching_sh,
    PartialRepay,
    test_st_policy_id,
    tx,
  )
}
