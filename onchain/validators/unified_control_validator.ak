use aiken/collection/dict
use aiken/collection/list
use aiken/crypto.{ScriptHash}
use aiken/primitive/bytearray
use cardano/address.{Address, Script}
use cardano/assets.{AssetName, PolicyId, from_asset, from_lovelace, quantity_of}
use cardano/transaction.{
  InlineDatum, Input, NoDatum, Output, OutputReference, Transaction, placeholder,
}
use mocktail/virgin_key_hash.{mock_policy_id, mock_script_hash}
use mocktail/virgin_output_reference.{mock_utxo_ref}
use statera/constants.{
  st_liquidation_asset_name, st_oracle_asset_name, st_pparams_asset_name,
}
use statera/datums.{
  ControlDatum, LiqFundsDatum, OracleDatum, ProtocolParametersDatum,
}
use statera/types.{
  AssetRate, AssetType, InitLiqFundsReceiver, InitOracle, InitProtocolParams,
  MintControl, RemoveControlMint, RemoveControlSpend, SpendControl,
  UpdateLiqFundsReceiver, UpdateOracle, UpdateProtocolParams,
}

validator unified_control_validator(admin_sc: ScriptHash) {
  spend(
    _datum: Option<ControlDatum>,
    redeemer: SpendControl,
    utxo: OutputReference,
    self: Transaction,
  ) {
    let Transaction { inputs, outputs, .. } = self
    expect Some(own_input) = transaction.find_input(inputs, utxo)
    expect Script(own_hash) = own_input.output.address.payment_credential

    when redeemer is {
      RemoveControlSpend ->
        validate_remove_control_spend(inputs, outputs, admin_sc, own_hash)
      _ ->
        validate_update_control(
          redeemer,
          inputs,
          outputs,
          own_input,
          own_hash,
          admin_sc,
        )
    }
  }

  mint(redeemer: MintControl, policy_id: PolicyId, self: Transaction) {
    let Transaction { inputs, outputs, mint, .. } = self

    expect [Pair(name, quantity)] =
      mint |> assets.tokens(policy_id) |> dict.to_pairs

    when redeemer is {
      RemoveControlMint -> validate_remove_control_mint(inputs, admin_sc)
      _ ->
        validate_init_control(
          redeemer,
          inputs,
          outputs,
          policy_id,
          name,
          quantity,
          admin_sc,
        )
    }
  }

  else(_) {
    fail
  }
}

fn validate_remove_control_spend(
  inputs: List<Input>,
  outputs: List<Output>,
  admin_sc: ScriptHash,
  own_hash: ScriptHash,
) {
  let control_outputs =
    list.filter(
      outputs,
      fn(output) {
        let is_control_datum =
          when output.datum is {
            InlineDatum(output_datum) ->
              if output_datum is ControlDatum {
                True
              } else {
                False
              }
            _ -> False
          }

        let is_asset_out = or {
            quantity_of(output.value, own_hash, st_oracle_asset_name) == 1,
            quantity_of(output.value, own_hash, st_pparams_asset_name) == 1,
            quantity_of(output.value, own_hash, st_liquidation_asset_name) == 1,
          }

        or {
          // No new control should be createdx during removal
          is_control_datum,
          // No asset should be allowed out; All has to be burned
          is_asset_out,
        }
      },
    )

  and {
    list.length(control_outputs) == 0,
    is_admin_signing(inputs, admin_sc),
  }
}

fn validate_remove_control_mint(inputs: List<Input>, admin_sc: ScriptHash) {
  is_admin_signing(inputs, admin_sc)
}

fn validate_update_control(
  redeemer: SpendControl,
  inputs: List<Input>,
  outputs: List<Output>,
  own_input: Input,
  own_hash: PolicyId,
  admin_sc: ScriptHash,
) {
  when redeemer is {
    UpdateOracle ->
      validate_update_control_in_out(
        inputs,
        outputs,
        own_input,
        own_hash,
        "oracle_datum",
        st_oracle_asset_name,
        admin_sc,
      )
    UpdateProtocolParams ->
      validate_update_control_in_out(
        inputs,
        outputs,
        own_input,
        own_hash,
        "protocol_parameters_datum",
        st_pparams_asset_name,
        admin_sc,
      )
    UpdateLiqFundsReceiver ->
      validate_update_control_in_out(
        inputs,
        outputs,
        own_input,
        own_hash,
        "liq_funds_datum",
        st_liquidation_asset_name,
        admin_sc,
      )
    _ -> False
  }
}

fn validate_update_control_in_out(
  inputs: List<Input>,
  outputs: List<Output>,
  own_input: Input,
  own_hash: PolicyId,
  which_datum: ByteArray,
  the_asset_name: AssetName,
  admin_sc: ScriptHash,
) {
  and {
    validate_control_input(own_input, own_hash, which_datum, the_asset_name),
    validate_control_output(outputs, own_hash, which_datum, the_asset_name),
    is_admin_signing(inputs, admin_sc),
  }
}

fn validate_control_input(
  input: Input,
  own_hash: PolicyId,
  which_datum: ByteArray,
  the_asset_name: AssetName,
) {
  expect InlineDatum(input_datum) = input.output.datum
  // Datum must of type "OracleDatum" or "ProtocolParametersDatum" or "LiqFundsDatum"
  when which_datum is {
    "oracle_datum" -> {
      expect OracleDatum { .. } = input_datum
    }
    "protocol_parameters_datum" -> {
      expect ProtocolParametersDatum { .. } = input_datum
    }
    "liq_funds_datum" -> {
      expect LiqFundsDatum { .. } = input_datum
    }
    _ -> fail
  }

  and {
    // Must be a UTxO going to own hash
    input.output.address.payment_credential == Script(own_hash),
    // Must only contain "STO" or "STP" or "STL" token apart from ADA
    assets.without_lovelace(input.output.value) == from_asset(
      own_hash,
      the_asset_name,
      1,
    ),
  }
}

fn validate_control_output(
  outputs: List<Output>,
  own_hash: PolicyId,
  which_datum: ByteArray,
  the_asset_name: AssetName,
) {
  let control_outputs =
    list.filter(
      outputs,
      fn(output) {
        expect InlineDatum(output_datum) = output.datum
        // Datum must of type "OracleDatum" or "ProtocolParametersDatum" or "LiqFundsDatum"
        when which_datum is {
          "oracle_datum" -> {
            expect OracleDatum { .. } = output_datum
            True
          }
          "protocol_parameters_datum" -> {
            expect ProtocolParametersDatum { .. } = output_datum
            True
          }
          "liq_funds_datum" -> {
            expect LiqFundsDatum { .. } = output_datum
            True
          }
          _ -> False
        }
      },
    )
  // Only one output
  expect list.length(control_outputs) == 1

  expect Some(control_output) = list.at(control_outputs, 0)

  and {
    // Must be a UTxO going to own hash
    control_output.address.payment_credential == Script(own_hash),
    // Must only contain "STO" or "STP" or "STL" token apart from ADA
    assets.without_lovelace(control_output.value) == from_asset(
      own_hash,
      the_asset_name,
      1,
    ),
  }
}

fn validate_init_control(
  redeemer: MintControl,
  inputs: List<Input>,
  outputs: List<Output>,
  policy_id: PolicyId,
  name: AssetName,
  quantity: Int,
  admin_sc: ScriptHash,
) {
  when redeemer is {
    InitOracle ->
      validate_init_control_out(
        inputs,
        outputs,
        policy_id,
        name,
        quantity,
        "oracle_datum",
        st_oracle_asset_name,
        admin_sc,
      )
    InitProtocolParams ->
      validate_init_control_out(
        inputs,
        outputs,
        policy_id,
        name,
        quantity,
        "protocol_parameters_datum",
        st_pparams_asset_name,
        admin_sc,
      )
    InitLiqFundsReceiver ->
      validate_init_control_out(
        inputs,
        outputs,
        policy_id,
        name,
        quantity,
        "liq_funds_datum",
        st_liquidation_asset_name,
        admin_sc,
      )
    _ -> False
  }
}

fn validate_init_control_out(
  inputs: List<Input>,
  outputs: List<Output>,
  policy_id: PolicyId,
  name: AssetName,
  quantity: Int,
  which_datum: ByteArray,
  the_asset_name: AssetName,
  admin_sc: ScriptHash,
) {
  expect Some(the_output) =
    list.find(
      outputs,
      fn(output) {
        expect InlineDatum(output_datum) = output.datum
        // Datum must of type "OracleDatum" or "ProtocolParametersDatum" or "LiqFundsDatum"
        when which_datum is {
          "oracle_datum" -> {
            expect OracleDatum { .. } = output_datum
          }
          "protocol_parameters_datum" -> {
            expect ProtocolParametersDatum { .. } = output_datum
          }
          "liq_funds_datum" -> {
            expect LiqFundsDatum { .. } = output_datum
          }
          _ -> fail
        }
        // Must be a UTxO going to own hash
        output.address.payment_credential == Script(policy_id)
      },
    )

  and {
    // Must only contain "STO" or "STP" or "STL" token apart from ADA
    assets.without_lovelace(the_output.value) == from_asset(
      policy_id,
      the_asset_name,
      1,
    ),
    // Must mint only 1 quantity of "the_asset_name" token
    name == the_asset_name,
    quantity == 1,
    // admin must sign the transaction
    is_admin_signing(inputs, admin_sc),
  }
}

fn is_admin_signing(inputs: List<Input>, admin_sc: ScriptHash) {
  list.any(
    inputs,
    fn(input) { input.output.address.payment_credential == Script(admin_sc) },
  )
}

// Tests
fn get_admin_input() {
  let admin_sc = mock_script_hash(10)

  let admin_input =
    Input {
      output_reference: mock_utxo_ref(0, 10),
      output: Output {
        address: Address {
          payment_credential: Script(admin_sc),
          stake_credential: None,
        },
        value: from_lovelace(2000000),
        datum: NoDatum,
        reference_script: None,
      },
    }

  (admin_sc, admin_input)
}

test test_init_oracle() {
  let unified_control_validator_hash = mock_script_hash(0)
  let sto = from_asset(unified_control_validator_hash, st_oracle_asset_name, 1)
  let (admin_sc, admin_input) = get_admin_input()

  let oracle_output =
    Output {
      address: Address {
        payment_credential: Script(unified_control_validator_hash),
        stake_credential: None,
      },
      value: assets.merge(from_lovelace(2000000), sto),
      datum: InlineDatum(
        OracleDatum {
          oracle_rates: [
            AssetRate { unit: "lovelace", num: 24, denum: 40000000 },
          ],
        },
      ),
      reference_script: None,
    }

  let mint = sto

  let tx =
    Transaction {
      ..placeholder,
      inputs: [admin_input],
      outputs: [oracle_output],
      mint: mint,
    }

  unified_control_validator.mint(
    admin_sc,
    InitOracle,
    unified_control_validator_hash,
    tx,
  )
}

test test_init_protocol_params() {
  let unified_control_validator_hash = mock_script_hash(0)
  let stp = from_asset(unified_control_validator_hash, st_pparams_asset_name, 1)
  let (admin_sc, admin_input) = get_admin_input()

  let protocol_params_output =
    Output {
      address: Address {
        payment_credential: Script(unified_control_validator_hash),
        stake_credential: None,
      },
      value: assets.merge(from_lovelace(2000000), stp),
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
    }

  let mint = stp

  let tx =
    Transaction {
      ..placeholder,
      inputs: [admin_input],
      outputs: [protocol_params_output],
      mint: mint,
    }

  unified_control_validator.mint(
    admin_sc,
    InitProtocolParams,
    unified_control_validator_hash,
    tx,
  )
}

test test_init_liq_funds() {
  let unified_control_validator_hash = mock_script_hash(0)
  let stl =
    from_asset(unified_control_validator_hash, st_liquidation_asset_name, 1)
  let (admin_sc, admin_input) = get_admin_input()

  let liq_funds_receiver = mock_script_hash(5)
  let liq_funds_output =
    Output {
      address: Address {
        payment_credential: Script(unified_control_validator_hash),
        stake_credential: None,
      },
      value: assets.merge(from_lovelace(2000000), stl),
      datum: InlineDatum(LiqFundsDatum { receiver: liq_funds_receiver }),
      reference_script: None,
    }

  let mint = stl

  let tx =
    Transaction {
      ..placeholder,
      inputs: [admin_input],
      outputs: [liq_funds_output],
      mint: mint,
    }

  unified_control_validator.mint(
    admin_sc,
    InitLiqFundsReceiver,
    unified_control_validator_hash,
    tx,
  )
}

test test_update_oracle() {
  let unified_control_validator_hash = mock_script_hash(0)
  let sto = from_asset(unified_control_validator_hash, st_oracle_asset_name, 1)
  let (admin_sc, admin_input) = get_admin_input()

  let oracle_input_datum =
    OracleDatum {
      oracle_rates: [AssetRate { unit: "lovelace", num: 24, denum: 40000000 }],
    }
  let oracle_input_utxo_ref = mock_utxo_ref(0, 11)
  let oracle_input =
    Input {
      output_reference: oracle_input_utxo_ref,
      output: Output {
        address: Address {
          payment_credential: Script(unified_control_validator_hash),
          stake_credential: None,
        },
        value: assets.merge(from_lovelace(2000000), sto),
        datum: InlineDatum(oracle_input_datum),
        reference_script: None,
      },
    }

  let hosky_pid = mock_policy_id(7)
  let hosky_an = "hosky"
  let hosky_unit = bytearray.concat(hosky_pid, hosky_an)
  let oracle_output =
    Output {
      address: Address {
        payment_credential: Script(unified_control_validator_hash),
        stake_credential: None,
      },
      value: assets.merge(from_lovelace(2000000), sto),
      datum: InlineDatum(
        // -> Add hosky rate
        OracleDatum {
          oracle_rates: [
            AssetRate { unit: "lovelace", num: 24, denum: 40000000 },
            AssetRate { unit: hosky_unit, num: 20_000_000, denum: 1_000_000 },
          ],
        },
      ),
      reference_script: None,
    }

  let tx =
    Transaction {
      ..placeholder,
      inputs: [admin_input, oracle_input],
      outputs: [oracle_output],
    }

  unified_control_validator.spend(
    admin_sc,
    Some(oracle_input_datum),
    UpdateOracle,
    oracle_input_utxo_ref,
    tx,
  )
}

test test_update_protocol_params() {
  let unified_control_validator_hash = mock_script_hash(0)
  let stp = from_asset(unified_control_validator_hash, st_pparams_asset_name, 1)
  let (admin_sc, admin_input) = get_admin_input()

  let pparams_input_datum =
    ProtocolParametersDatum {
      min_collateral_ratio: 150,
      min_liquidation_threshold: 120,
      min_loan_amount: 10,
      protocol_usage_fee: 2,
      collateral_assets: [
        AssetType { is_stable: False, policy_id: "", asset_name: "lovelace" },
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
    }
  let pparams_input_utxo_ref = mock_utxo_ref(0, 11)
  let pparams_input =
    Input {
      output_reference: pparams_input_utxo_ref,
      output: Output {
        address: Address {
          payment_credential: Script(unified_control_validator_hash),
          stake_credential: None,
        },
        value: assets.merge(from_lovelace(2000000), stp),
        datum: InlineDatum(pparams_input_datum),
        reference_script: None,
      },
    }

  let pparams_output =
    Output {
      address: Address {
        payment_credential: Script(unified_control_validator_hash),
        stake_credential: None,
      },
      value: assets.merge(from_lovelace(2000000), stp),
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
              // -> changed policy ID
              policy_id: mock_policy_id(15),
              asset_name: "iUSD",
            },
            AssetType {
              is_stable: False,
              // -> changed policy ID
              policy_id: mock_policy_id(17),
              asset_name: "hosky",
            },
          ],
        },
      ),
      reference_script: None,
    }

  let tx =
    Transaction {
      ..placeholder,
      inputs: [admin_input, pparams_input],
      outputs: [pparams_output],
    }

  unified_control_validator.spend(
    admin_sc,
    Some(pparams_input_datum),
    UpdateProtocolParams,
    pparams_input_utxo_ref,
    tx,
  )
}

test test_update_liq_funds() {
  let unified_control_validator_hash = mock_script_hash(0)
  let stl =
    from_asset(unified_control_validator_hash, st_liquidation_asset_name, 1)
  let (admin_sc, admin_input) = get_admin_input()

  let liq_funds_receiver = mock_script_hash(5)
  let new_liq_funds_receiver = mock_script_hash(14)

  let liq_funds_input_datum = LiqFundsDatum { receiver: liq_funds_receiver }
  let liq_funds_input_utxo_ref = mock_utxo_ref(0, 11)
  let liq_funds_input =
    Input {
      output_reference: liq_funds_input_utxo_ref,
      output: Output {
        address: Address {
          payment_credential: Script(unified_control_validator_hash),
          stake_credential: None,
        },
        value: assets.merge(from_lovelace(2000000), stl),
        datum: InlineDatum(liq_funds_input_datum),
        reference_script: None,
      },
    }

  let liq_funds_output =
    Output {
      address: Address {
        payment_credential: Script(unified_control_validator_hash),
        stake_credential: None,
      },
      value: assets.merge(from_lovelace(2000000), stl),
      datum: InlineDatum(
        // -> Change liquidated funds receiver
        LiqFundsDatum { receiver: new_liq_funds_receiver },
      ),
      reference_script: None,
    }

  let tx =
    Transaction {
      ..placeholder,
      inputs: [admin_input, liq_funds_input],
      outputs: [liq_funds_output],
    }

  unified_control_validator.spend(
    admin_sc,
    Some(liq_funds_input_datum),
    UpdateLiqFundsReceiver,
    liq_funds_input_utxo_ref,
    tx,
  )
}

test test_remove_oracle() {
  let unified_control_validator_hash = mock_script_hash(0)
  let (admin_sc, admin_input) = get_admin_input()

  let oracle_utxo_ref = mock_utxo_ref(0, 11)
  let oracle_datum =
    OracleDatum {
      oracle_rates: [AssetRate { unit: "lovelace", num: 24, denum: 40000000 }],
    }
  let oracle_input =
    Input {
      output_reference: oracle_utxo_ref,
      output: Output {
        address: Address {
          payment_credential: Script(unified_control_validator_hash),
          stake_credential: None,
        },
        value: assets.merge(
          from_lovelace(2000000),
          from_asset(unified_control_validator_hash, st_oracle_asset_name, 1),
        ),
        datum: InlineDatum(oracle_datum),
        reference_script: None,
      },
    }

  let admin_output =
    Output {
      address: Address {
        payment_credential: Script(admin_sc),
        stake_credential: None,
      },
      value: from_lovelace(2000000),
      datum: NoDatum,
      reference_script: None,
    }

  let mint =
    from_asset(unified_control_validator_hash, st_oracle_asset_name, -1)

  let tx =
    Transaction {
      ..placeholder,
      inputs: [admin_input, oracle_input],
      outputs: [admin_output],
      mint: mint,
    }

  unified_control_validator.spend(
    admin_sc,
    Some(oracle_datum),
    RemoveControlSpend,
    oracle_utxo_ref,
    tx,
  ) && unified_control_validator.mint(
    admin_sc,
    RemoveControlMint,
    unified_control_validator_hash,
    tx,
  )
}
