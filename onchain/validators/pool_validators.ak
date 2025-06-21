use aiken/collection/dict
use aiken/collection/list
use aiken/collection/pairs
use aiken/crypto.{ScriptHash}
use cardano/address.{Address, Credential, Script, VerificationKey}
use cardano/assets.{
  AssetName, PolicyId, Value, from_asset, from_lovelace, quantity_of,
  without_lovelace,
}
use cardano/transaction.{
  InlineDatum, Input, NoDatum, Output, OutputReference, Transaction, find_input,
  placeholder,
}
use mocktail/virgin_address.{mock_pub_key_address}
use mocktail/virgin_key_hash.{
  mock_policy_id, mock_pub_key_hash, mock_script_hash,
}
use mocktail/virgin_output_reference.{mock_utxo_ref}
use statera/constants.{
  st_pool_nft_name, st_pparams_asset_name, st_stable_asset_name,
}
use statera/datums.{Buy, OrderDatum, PoolDatum, ProtocolParametersDatum, Sell}
use statera/test_fns.{get_protocol_parameters_ref}
use statera/types.{
  AssetType, BatchingType, CancelOrder, OrderRedeemer, PoolBatchingRedeemer,
  ProcessOrder,
}
use statera/utils.{find_ucv_ref_input, is_multisig_signing, signed_by}

validator order_validator(pool_batching_cred: Credential) {
  spend(
    _datum: Option<OrderDatum>,
    _redeemer: Data,
    utxo: OutputReference,
    tx: Transaction,
  ) {
    let Transaction { inputs, .. } = tx

    expect Some(order_input) = find_input(inputs, utxo)
    let Input {
      output: Output { address: Address { payment_credential, .. }, .. },
      ..
    } = order_input

    pairs.has_key(tx.withdrawals, payment_credential)
  }

  withdraw(redeemer: OrderRedeemer, account: Credential, tx: Transaction) {
    let Transaction { inputs, outputs, extra_signatories, withdrawals, .. } = tx

    when redeemer is {
      CancelOrder -> {
        expect Script(own_hash) = account

        // only one order input when cancelling an order
        expect [order_input] =
          list.filter(
            inputs,
            fn(input) {
              input.output.address.payment_credential == Script(own_hash)
            },
          )

        expect InlineDatum(order_datum) = order_input.output.datum
        expect OrderDatum { receiver_address, canceller, .. } = order_datum

        expect Some(_order_output) =
          list.find(
            outputs,
            fn(output) {
              // order output must go to 'receiver address'
              and {
                output.address == receiver_address,
                output.value == order_input.output.value,
              }
            },
          )

        signed_by(extra_signatories, canceller)?
      }

      ProcessOrder -> pairs.has_key(withdrawals, pool_batching_cred)
    }
  }

  else(_) {
    fail
  }
}

validator pool_validator(unified_control_validator_hash: ScriptHash) {
  mint(_redeemer: Data, policy_id: PolicyId, tx: Transaction) {
    let Transaction { mint, outputs, inputs, reference_inputs, .. } = tx

    expect [Pair(nft_name, quantity)] =
      mint |> assets.tokens(policy_id) |> dict.to_pairs

    let is_pool_nft_minting = and {
        nft_name == st_pool_nft_name,
        quantity == 1,
      }

    // only one pool output
    expect Some(pool_output) =
      list.find(
        outputs,
        fn(output) { output.address.payment_credential == Script(policy_id) },
      )

    // find protocol parameters from reference inputs
    expect Some(protocol_parameters_ref) =
      find_ucv_ref_input(
        reference_inputs,
        unified_control_validator_hash,
        st_pparams_asset_name,
      )
    expect InlineDatum(protocol_parameters) =
      protocol_parameters_ref.output.datum
    expect ProtocolParametersDatum { admin, .. } = protocol_parameters

    and {
      // pool NFT has to be minted
      is_pool_nft_minting?,
      // a pool output with the nft has to exist
      (quantity_of(pool_output.value, policy_id, st_pool_nft_name) == 1)?,
      // admin must sign pool creation transaction
      is_multisig_signing(inputs, admin)?,
    }
  }

  spend(
    datum: Option<PoolDatum>,
    _redeemer: Data,
    _utxo: OutputReference,
    tx: Transaction,
  ) {
    expect Some(PoolDatum { pool_batching_cred }) = datum
    pairs.has_key(tx.withdrawals, pool_batching_cred)
  }

  else(_) {
    fail
  }
}

validator pool_batching_validator(
  unified_control_validator_hash: ScriptHash,
  pool_validator_hash: ScriptHash,
) {
  withdraw(
    redeemer: PoolBatchingRedeemer,
    _account: Credential,
    tx: Transaction,
  ) {
    let Transaction {
      reference_inputs,
      extra_signatories,
      inputs,
      outputs,
      mint,
      ..
    } = tx

    let PoolBatchingRedeemer { batcher_index, pool_asset } = redeemer

    // find protocol parameters from reference inputs
    expect Some(protocol_parameters_ref) =
      find_ucv_ref_input(
        reference_inputs,
        unified_control_validator_hash,
        st_pparams_asset_name,
      )

    expect InlineDatum(protocol_parameters) =
      protocol_parameters_ref.output.datum
    expect ProtocolParametersDatum {
      st_asset,
      swappable_assets,
      authorized_batchers,
      ..
    } = protocol_parameters
    expect Some(batcher) = list.at(authorized_batchers, batcher_index)

    // pool asset must be a swappable asset
    expect list.has(swappable_assets, pool_asset)
    // find pool input
    expect Some(pool_input) =
      list.find(
        inputs,
        fn(input) {
          verify_pool_utxo(input.output, pool_validator_hash, pool_asset)
        },
      )
    // find pool output
    expect Some(pool_output) =
      list.find(
        outputs,
        fn(output) { verify_pool_utxo(output, pool_validator_hash, pool_asset) },
      )
    // pool datum must remain the same
    expect pool_input.output.datum == pool_output.datum

    // Assumes all other inputs that are not batcher or pool are orders
    let order_inputs =
      list.filter(
        inputs,
        fn(input) {
          let Input {
            output: Output {
              address: Address { payment_credential: order_payment_cred, .. },
              ..
            },
            ..
          } = input
          and {
            order_payment_cred != Script(pool_validator_hash),
            order_payment_cred != VerificationKey(batcher),
          }
        },
      )

    let AssetType { policy_id: mint_st_validator_hash, .. } = st_asset
    expect [Pair(mint_name, mint_quantity)] =
      mint |> assets.tokens(mint_st_validator_hash) |> dict.to_pairs
    expect mint_name == st_stable_asset_name

    let expected_batched_output: BatchingType =
      (
        quantity_of(
          pool_output.value,
          pool_asset.policy_id,
          pool_asset.asset_name,
        ),
        mint_quantity,
      )

    let batching_input: BatchingType =
      (
        quantity_of(
          pool_input.output.value,
          pool_asset.policy_id,
          pool_asset.asset_name,
        ),
        0,
      )

    and {
      // an authorized batcher must sign the transaction
      signed_by(extra_signatories, batcher),
      // expected batched output must be equal to calculated batch ouput after processing orders
      trace @"ex": expected_batched_output
      trace @"po": process_orders(
        order_inputs,
        batching_input,
        pool_asset,
        mint_st_validator_hash,
        outputs,
      )
      expected_batched_output == process_orders(
        order_inputs,
        batching_input,
        pool_asset,
        mint_st_validator_hash,
        outputs,
      ),
    }
  }

  else(_) {
    fail
  }
}

fn verify_pool_utxo(
  output: Output,
  pool_validator_hash: ScriptHash,
  pool_asset: AssetType,
) {
  let AssetType { policy_id, asset_name, .. } = pool_asset

  and {
    output.address.payment_credential == Script(pool_validator_hash),
    // pool utxo must contain only one asset specified in the pool batching redeemer
    without_lovelace(output.value) == assets.merge(
      from_asset(
        policy_id,
        asset_name,
        quantity_of(output.value, policy_id, asset_name),
      ),
      from_asset(pool_validator_hash, st_pool_nft_name, 1),
    ),
  }
}

fn process_orders(
  order_inputs: List<Input>,
  batching_input: BatchingType,
  pool_asset: AssetType,
  mint_st_validator_hash: ScriptHash,
  outputs: List<Output>,
) -> BatchingType {
  if !list.is_empty(order_inputs) {
    expect [order_input, ..rest_order_inputs] = order_inputs
    expect InlineDatum(order_datum) = order_input.output.datum
    expect OrderDatum { order_type, receiver_address, .. } = order_datum

    let AssetType { policy_id: pool_asset_pid, asset_name: pool_asset_name, .. } =
      pool_asset

    // If it's a buy order, the pool asset quantity from the order input should be deducted completely (and added to the pool), and an equivalent amount of st should be minted
    // Else if it's a sell order, the st should be burned, and an equivalent pool asset quantity should be deducted from the pool and sent to the order receiver
    let (pool_asset_amount, st_amount) =
      when order_type is {
        Buy -> {
          let pool_asset_quantity =
            quantity_of(
              order_input.output.value,
              pool_asset_pid,
              pool_asset_name,
            )
          (pool_asset_quantity, pool_asset_quantity)
        }
        Sell -> {
          let st_asset_quantity =
            quantity_of(
              order_input.output.value,
              mint_st_validator_hash,
              st_stable_asset_name,
            )
          (-st_asset_quantity, -st_asset_quantity)
        }
      }

    // make sure there is a corresponding order output for each order input
    verify_order_output(
      order_input.output.value,
      outputs,
      pool_asset_pid,
      pool_asset_name,
      pool_asset_amount,
      mint_st_validator_hash,
      receiver_address,
    )

    let (quantity_of_pool_asset, st_mint_quantity) = batching_input
    process_orders(
      rest_order_inputs,
      (quantity_of_pool_asset + pool_asset_amount, st_mint_quantity + st_amount),
      pool_asset,
      mint_st_validator_hash,
      outputs,
    )
  } else {
    batching_input
  }
}

fn verify_order_output(
  order_in_value: Value,
  outputs: List<Output>,
  pool_asset_pid: PolicyId,
  pool_asset_name: AssetName,
  pool_asset_amount: Int,
  mint_st_validator_hash: ScriptHash,
  receiver_address: Address,
) {
  expect Some(_order_output) =
    list.find(
      outputs,
      fn(output) {
        // pool_asset_amount will come into this function (verify_order_output) as positive for buy orders and negative for sell orders
        let order_out_value =
          order_in_value
            |> assets.add(pool_asset_pid, pool_asset_name, -pool_asset_amount)
            |> assets.add(
                mint_st_validator_hash,
                st_stable_asset_name,
                pool_asset_amount,
              )

        // receiver address should receive the processed order output
        and {
          output.value == order_out_value,
          output.address == receiver_address,
        }
      },
    )
}

// Tests

fn create_order_input(o_value: Value, o_datum: OrderDatum, ur_num: Int) {
  let order_script_hash = mock_script_hash(0)

  Input {
    output: Output {
      address: Address {
        payment_credential: Script(order_script_hash),
        stake_credential: None,
      },
      value: o_value,
      datum: InlineDatum(o_datum),
      reference_script: None,
    },
    output_reference: mock_utxo_ref(ur_num, 0),
  }
}

fn create_order_output(o_value: Value, receiver_address: Address) {
  Output {
    address: receiver_address,
    value: o_value,
    datum: NoDatum,
    reference_script: None,
  }
}

fn create_pool_batching_tx(
  order_inputs: List<Input>,
  order_outputs: List<Output>,
  pool_out_quantity: Int,
  st_mint_quantity: Int,
) {
  let pool_script_hash = mock_script_hash(3)
  let pool_batching_sh = mock_script_hash(5)
  let unified_control_validator_hash = mock_script_hash(1)

  let test_usdm_pid = mock_policy_id(13)
  let test_usdm_asset_name = "usdm"
  let st_pid = mock_policy_id(21)

  let pool_datum =
    InlineDatum(PoolDatum { pool_batching_cred: Script(pool_batching_sh) })

  let pool_input =
    Input {
      output: Output {
        address: Address {
          payment_credential: Script(pool_script_hash),
          stake_credential: None,
        },
        value: from_lovelace(5_000_000)
          |> assets.add(test_usdm_pid, test_usdm_asset_name, 500_000_000)
          |> assets.add(pool_script_hash, st_pool_nft_name, 1),
        datum: pool_datum,
        reference_script: None,
      },
      output_reference: mock_utxo_ref(0, 1),
    }

  let pool_output =
    Output {
      address: Address {
        payment_credential: Script(pool_script_hash),
        stake_credential: None,
      },
      value: from_lovelace(5_000_000)
        |> assets.add(test_usdm_pid, test_usdm_asset_name, pool_out_quantity)
        |> assets.add(pool_script_hash, st_pool_nft_name, 1),
      datum: pool_datum,
      reference_script: None,
    }

  let protocol_parameters_ref = get_protocol_parameters_ref()

  let mint = from_asset(st_pid, st_stable_asset_name, st_mint_quantity)

  let pool_batching_redeemer =
    PoolBatchingRedeemer {
      batcher_index: 0,
      pool_asset: AssetType {
        is_stable: True,
        policy_id: mock_policy_id(13),
        asset_name: "usdm",
      },
    }

  let batcher = mock_pub_key_hash(0)

  let tx =
    Transaction {
      ..placeholder,
      inputs: [pool_input, ..order_inputs],
      outputs: [pool_output, ..order_outputs],
      reference_inputs: [protocol_parameters_ref],
      mint: mint,
      extra_signatories: [batcher],
    }

  pool_batching_validator.withdraw(
    unified_control_validator_hash,
    pool_script_hash,
    pool_batching_redeemer,
    Script(pool_batching_sh),
    tx,
  )
}

test test_process_buy_order() {
  let test_usdm_pid = mock_policy_id(13)
  let test_usdm_asset_name = "usdm"
  let st_pid = mock_policy_id(21)

  let receiver_address_1 = mock_pub_key_address(1, None)
  let order_input_1 =
    create_order_input(
      assets.merge(
        from_lovelace(3_000_000),
        from_asset(test_usdm_pid, test_usdm_asset_name, 50_000_000),
      ),
      OrderDatum {
        order_type: Buy,
        receiver_address: receiver_address_1,
        canceller: mock_pub_key_hash(3),
      },
      1,
    )
  let order_output_1 =
    create_order_output(
      assets.merge(
        from_lovelace(3_000_000),
        from_asset(st_pid, st_stable_asset_name, 50_000_000),
      ),
      receiver_address_1,
    )

  create_pool_batching_tx(
    [order_input_1],
    [order_output_1],
    550_000_000,
    50_000_000,
  )
}

test test_process_sell_order() {
  let test_usdm_pid = mock_policy_id(13)
  let test_usdm_asset_name = "usdm"
  let st_pid = mock_policy_id(21)

  let receiver_address_1 = mock_pub_key_address(1, None)
  let order_input_1 =
    create_order_input(
      assets.merge(
        from_lovelace(3_000_000),
        from_asset(st_pid, st_stable_asset_name, 50_000_000),
      ),
      OrderDatum {
        order_type: Sell,
        receiver_address: receiver_address_1,
        canceller: mock_pub_key_hash(3),
      },
      1,
    )
  let order_output_1 =
    create_order_output(
      assets.merge(
        from_lovelace(3_000_000),
        from_asset(test_usdm_pid, test_usdm_asset_name, 50_000_000),
      ),
      receiver_address_1,
    )

  create_pool_batching_tx(
    [order_input_1],
    [order_output_1],
    450_000_000,
    -50_000_000,
  )
}

test test_process_several_buy_orders() {
  let test_usdm_pid = mock_policy_id(13)
  let test_usdm_asset_name = "usdm"
  let st_pid = mock_policy_id(21)

  // order 1
  let receiver_address_1 = mock_pub_key_address(1, None)
  let order_input_1 =
    create_order_input(
      assets.merge(
        from_lovelace(3_000_000),
        from_asset(test_usdm_pid, test_usdm_asset_name, 50_000_000),
      ),
      OrderDatum {
        order_type: Buy,
        receiver_address: receiver_address_1,
        canceller: mock_pub_key_hash(3),
      },
      1,
    )
  let order_output_1 =
    create_order_output(
      assets.merge(
        from_lovelace(3_000_000),
        from_asset(st_pid, st_stable_asset_name, 50_000_000),
      ),
      receiver_address_1,
    )

  // order 2
  let receiver_address_2 = mock_pub_key_address(2, None)
  let order_input_2 =
    create_order_input(
      assets.merge(
        from_lovelace(3_000_000),
        from_asset(test_usdm_pid, test_usdm_asset_name, 100_000_000),
      ),
      OrderDatum {
        order_type: Buy,
        receiver_address: receiver_address_2,
        canceller: mock_pub_key_hash(3),
      },
      1,
    )
  let order_output_2 =
    create_order_output(
      assets.merge(
        from_lovelace(3_000_000),
        from_asset(st_pid, st_stable_asset_name, 100_000_000),
      ),
      receiver_address_2,
    )

  // order 3
  let receiver_address_3 = mock_pub_key_address(3, None)
  let order_input_3 =
    create_order_input(
      assets.merge(
        from_lovelace(3_000_000),
        from_asset(test_usdm_pid, test_usdm_asset_name, 70_000_000),
      ),
      OrderDatum {
        order_type: Buy,
        receiver_address: receiver_address_3,
        canceller: mock_pub_key_hash(3),
      },
      1,
    )
  let order_output_3 =
    create_order_output(
      assets.merge(
        from_lovelace(3_000_000),
        from_asset(st_pid, st_stable_asset_name, 70_000_000),
      ),
      receiver_address_3,
    )

  create_pool_batching_tx(
    [order_input_1, order_input_2, order_input_3],
    [order_output_1, order_output_2, order_output_3],
    720_000_000,
    220_000_000,
  )
}

test test_process_several_sell_orders() {
  let test_usdm_pid = mock_policy_id(13)
  let test_usdm_asset_name = "usdm"
  let st_pid = mock_policy_id(21)

  // order 1
  let receiver_address_1 = mock_pub_key_address(1, None)
  let order_input_1 =
    create_order_input(
      assets.merge(
        from_lovelace(3_000_000),
        from_asset(st_pid, st_stable_asset_name, 50_000_000),
      ),
      OrderDatum {
        order_type: Sell,
        receiver_address: receiver_address_1,
        canceller: mock_pub_key_hash(3),
      },
      1,
    )
  let order_output_1 =
    create_order_output(
      assets.merge(
        from_lovelace(3_000_000),
        from_asset(test_usdm_pid, test_usdm_asset_name, 50_000_000),
      ),
      receiver_address_1,
    )

  // order 2
  let receiver_address_2 = mock_pub_key_address(2, None)
  let order_input_2 =
    create_order_input(
      assets.merge(
        from_lovelace(3_000_000),
        from_asset(st_pid, st_stable_asset_name, 100_000_000),
      ),
      OrderDatum {
        order_type: Sell,
        receiver_address: receiver_address_2,
        canceller: mock_pub_key_hash(3),
      },
      1,
    )
  let order_output_2 =
    create_order_output(
      assets.merge(
        from_lovelace(3_000_000),
        from_asset(test_usdm_pid, test_usdm_asset_name, 100_000_000),
      ),
      receiver_address_2,
    )

  // order 3
  let receiver_address_3 = mock_pub_key_address(3, None)
  let order_input_3 =
    create_order_input(
      assets.merge(
        from_lovelace(3_000_000),
        from_asset(st_pid, st_stable_asset_name, 70_000_000),
      ),
      OrderDatum {
        order_type: Sell,
        receiver_address: receiver_address_3,
        canceller: mock_pub_key_hash(3),
      },
      1,
    )
  let order_output_3 =
    create_order_output(
      assets.merge(
        from_lovelace(3_000_000),
        from_asset(test_usdm_pid, test_usdm_asset_name, 70_000_000),
      ),
      receiver_address_3,
    )

  create_pool_batching_tx(
    [order_input_1, order_input_2, order_input_3],
    [order_output_1, order_output_2, order_output_3],
    280_000_000,
    -220_000_000,
  )
}

test test_process_both_buy_and_sell_orders() {
  let test_usdm_pid = mock_policy_id(13)
  let test_usdm_asset_name = "usdm"
  let st_pid = mock_policy_id(21)

  // order 1 (Sell)
  let receiver_address_1 = mock_pub_key_address(1, None)
  let order_input_1 =
    create_order_input(
      assets.merge(
        from_lovelace(3_000_000),
        from_asset(st_pid, st_stable_asset_name, 50_000_000),
      ),
      OrderDatum {
        order_type: Sell,
        receiver_address: receiver_address_1,
        canceller: mock_pub_key_hash(3),
      },
      1,
    )
  let order_output_1 =
    create_order_output(
      assets.merge(
        from_lovelace(3_000_000),
        from_asset(test_usdm_pid, test_usdm_asset_name, 50_000_000),
      ),
      receiver_address_1,
    )

  // order 2 (Sell)
  let receiver_address_2 = mock_pub_key_address(2, None)
  let order_input_2 =
    create_order_input(
      assets.merge(
        from_lovelace(3_000_000),
        from_asset(st_pid, st_stable_asset_name, 100_000_000),
      ),
      OrderDatum {
        order_type: Sell,
        receiver_address: receiver_address_2,
        canceller: mock_pub_key_hash(3),
      },
      1,
    )
  let order_output_2 =
    create_order_output(
      assets.merge(
        from_lovelace(3_000_000),
        from_asset(test_usdm_pid, test_usdm_asset_name, 100_000_000),
      ),
      receiver_address_2,
    )

  // order 3 (Buy)
  let receiver_address_3 = mock_pub_key_address(3, None)
  let order_input_3 =
    create_order_input(
      assets.merge(
        from_lovelace(3_000_000),
        from_asset(test_usdm_pid, test_usdm_asset_name, 70_000_000),
      ),
      OrderDatum {
        order_type: Buy,
        receiver_address: receiver_address_3,
        canceller: mock_pub_key_hash(3),
      },
      1,
    )
  let order_output_3 =
    create_order_output(
      assets.merge(
        from_lovelace(3_000_000),
        from_asset(st_pid, st_stable_asset_name, 70_000_000),
      ),
      receiver_address_3,
    )

  // order 4 (Buy)
  let receiver_address_4 = mock_pub_key_address(4, None)
  let order_input_4 =
    create_order_input(
      assets.merge(
        from_lovelace(3_000_000),
        from_asset(test_usdm_pid, test_usdm_asset_name, 195_000_000),
      ),
      OrderDatum {
        order_type: Buy,
        receiver_address: receiver_address_4,
        canceller: mock_pub_key_hash(3),
      },
      1,
    )
  let order_output_4 =
    create_order_output(
      assets.merge(
        from_lovelace(3_000_000),
        from_asset(st_pid, st_stable_asset_name, 195_000_000),
      ),
      receiver_address_4,
    )

  create_pool_batching_tx(
    [order_input_1, order_input_2, order_input_3, order_input_4],
    [order_output_1, order_output_2, order_output_3, order_output_4],
    615_000_000,
    115_000_000,
  )
}

test test_pool_creation() {
  let pool_script_hash = mock_script_hash(3)
  let pool_batching_sh = mock_script_hash(5)
  let unified_control_validator_hash = mock_script_hash(1)

  let test_usdm_pid = mock_policy_id(13)
  let test_usdm_asset_name = "usdm"

  let admin_input =
    Input {
      output_reference: mock_utxo_ref(0, 10),
      output: Output {
        address: Address {
          payment_credential: Script(mock_script_hash(10)),
          stake_credential: None,
        },
        value: from_lovelace(2000000),
        datum: NoDatum,
        reference_script: None,
      },
    }

  let pool_datum =
    InlineDatum(PoolDatum { pool_batching_cred: Script(pool_batching_sh) })
  let pool_output =
    Output {
      address: Address {
        payment_credential: Script(pool_script_hash),
        stake_credential: None,
      },
      value: from_lovelace(5_000_000)
        |> assets.add(test_usdm_pid, test_usdm_asset_name, 10_000_000_000)
        |> assets.add(pool_script_hash, st_pool_nft_name, 1),
      datum: pool_datum,
      reference_script: None,
    }

  let protocol_parameters_ref = get_protocol_parameters_ref()

  let mint = from_asset(pool_script_hash, st_pool_nft_name, 1)

  let tx =
    Transaction {
      ..placeholder,
      inputs: [admin_input],
      outputs: [pool_output],
      reference_inputs: [protocol_parameters_ref],
      mint: mint,
    }

  pool_validator.mint(unified_control_validator_hash, "", pool_script_hash, tx)
}

test test_cancel_order() {
  let st_pid = mock_policy_id(21)
  let pool_batching_sh = mock_script_hash(5)
  let receiver_address = mock_pub_key_address(1, None)
  let canceller = mock_pub_key_hash(3)
  let order_script_hash = mock_script_hash(0)

  let order_datum = OrderDatum { order_type: Sell, receiver_address, canceller }

  let order_input =
    create_order_input(
      assets.merge(
        from_lovelace(3_000_000),
        from_asset(st_pid, st_stable_asset_name, 50_000_000),
      ),
      order_datum,
      1,
    )

  let order_output =
    create_order_output(
      assets.merge(
        from_lovelace(3_000_000),
        from_asset(st_pid, st_stable_asset_name, 50_000_000),
      ),
      receiver_address,
    )

  let tx =
    Transaction {
      ..placeholder,
      inputs: [order_input],
      outputs: [order_output],
      extra_signatories: [canceller],
      withdrawals: [Pair(Script(order_script_hash), 0)],
    }

  order_validator.spend(
    Script(pool_batching_sh),
    Some(order_datum),
    "",
    mock_utxo_ref(1, 0),
    tx,
  ) && order_validator.withdraw(
    Script(pool_batching_sh),
    CancelOrder,
    Script(order_script_hash),
    tx,
  )
}
