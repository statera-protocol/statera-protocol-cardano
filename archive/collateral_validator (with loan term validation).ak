use aiken/collection/dict
use aiken/crypto.{ScriptHash}
use aiken/interval.{Finite, Interval, IntervalBound, PositiveInfinity}
use cardano/address.{Address, Script}
use cardano/assets.{
  AssetName, PolicyId, from_asset, from_asset_list, from_lovelace, lovelace_of,
  quantity_of,
}
use cardano/transaction.{
  InlineDatum, Input, NoDatum, Output, OutputReference, Transaction,
  ValidityRange, find_input, placeholder,
}
use halalend/constants.{usd_with_lovelace_precision_factor}
use halalend/datums.{CollateralDatum, ProtocolParametersDatum}
use halalend/utils.{
  calculate_by_percentage, find_input_by_hash, find_output_by_hash,
  is_loan_term_end,
}
use mocktail/virgin_key_hash.{mock_policy_id, mock_script_hash}
use mocktail/virgin_output_reference.{mock_utxo_ref}

pub type Action {
  Refund
  Liquidate
}

validator collateral_validator(
  protocol_parameters_hash: ScriptHash,
  oracle_hash: ScriptHash,
  liquidated_funds_collector_hash: ScriptHash,
) {
  spend(
    datum: Option<CollateralDatum>,
    redeemer: Action,
    o_ref: OutputReference,
    self: Transaction,
  ) {
    let Transaction {
      inputs,
      outputs,
      mint,
      validity_range,
      reference_inputs,
      ..
    } = self

    expect Some(own_input) = find_input(inputs, o_ref)

    expect Some(CollateralDatum {
      tusd_policy_id,
      tusd_asset_name,
      loan_nft_pid,
      collateral_rate_in_lovelace,
      loan_term,
      ..
    }) = datum

    when redeemer is {
      Refund -> {
        expect [Pair(_, quantity)] =
          mint |> assets.tokens(loan_nft_pid) |> dict.to_pairs

        (quantity == -1)?
      }

      Liquidate -> and {
          or {
            is_loan_term_end(validity_range, loan_term)?,
            is_liquidation_threshold_reached(
              protocol_parameters_hash,
              oracle_hash,
              collateral_rate_in_lovelace,
              reference_inputs,
              tusd_policy_id,
              tusd_asset_name,
            ),
          },
          liquidated_funds_must_go_to_collector(
            outputs,
            own_input,
            liquidated_funds_collector_hash,
          ),
        }
    }
  }

  else(_) {
    fail
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

// Tests
fn get_collateral_details() {
  let loan_nft_policy_id = mock_policy_id(0)

  let collateral_validator_script_hash = mock_script_hash(2)
  let tusd_pool_script_hash = mock_script_hash(3)
  let test_usd_policy_id = mock_policy_id(0)
  let test_usd_asset_name = "tUSD"
  let collateral_amount_in_lovelace = 15000000
  let collateral_datum =
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
      loan_term: 10000,
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

  let (collateral_datum, collateral_input) = get_collateral_details()

  let mint =
    from_asset_list([Pair(loan_nft_policy_id, [Pair("BorrowNFT1", -1)])])

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

test test_liquidate_loan_with_loan_term_end() {
  let protocol_parameters_script_hash = mock_script_hash(1)
  let oracle_script_hash = mock_script_hash(4)
  let liquidated_funds_collector_script_hash = mock_script_hash(5)
  let collateral_input_utxo_ref = mock_utxo_ref(0, 1)
  let collateral_amount_in_lovelace = 15000000

  let (collateral_datum, collateral_input) = get_collateral_details()

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

  let validity_range: ValidityRange =
    Interval {
      lower_bound: IntervalBound {
        bound_type: Finite(11000),
        is_inclusive: True,
      },
      upper_bound: IntervalBound {
        bound_type: PositiveInfinity,
        is_inclusive: False,
      },
    }

  let tx =
    Transaction {
      ..placeholder,
      inputs: [collateral_input],
      outputs: [collector_output],
      validity_range: validity_range,
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
            loan_term: 12000,
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
