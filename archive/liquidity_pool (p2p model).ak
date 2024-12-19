use aiken/collection/list
use aiken/crypto.{ScriptHash}
use cardano/address.{Address, Script}
use cardano/assets.{AssetName, PolicyId, from_asset, from_lovelace, quantity_of}
use cardano/transaction.{
  InlineDatum, NoDatum, Output, OutputReference, Transaction, placeholder,
}
use halalend/datums.{CollateralDatum}
use halalend/utils.{find_output_by_hash}
use mocktail/virgin_key_hash.{
  mock_policy_id, mock_pub_key_hash, mock_script_hash,
}
use mocktail/virgin_output_reference.{mock_utxo_ref}

validator liquidity_pool(collateral_validator_hash: ScriptHash) {
  spend(_d: Option<Data>, _r: Data, _o: OutputReference, self: Transaction) {
    let Transaction { outputs, .. } = self

    expect Some(collateral_output) =
      find_output_by_hash(outputs, collateral_validator_hash)

    expect InlineDatum(collateral_output_datum) = collateral_output.datum

    expect CollateralDatum {
      tusd_policy_id,
      tusd_asset_name,
      tusd_borrowed,
      ..
    } = collateral_output_datum

    output_tusd_must_equal_tusd_borrowed(
      outputs,
      tusd_policy_id,
      tusd_asset_name,
      tusd_borrowed,
    )
  }

  else(_) {
    fail
  }
}

fn output_tusd_must_equal_tusd_borrowed(
  outputs: List<Output>,
  tusd_policy_id: PolicyId,
  tusd_asset_name: AssetName,
  tusd_borrowed: Int,
) {
  let tusd_total_in_outputs =
    outputs
      |> list.foldl(
          0,
          fn(output, tusd_total) {
            let tusd_amount =
              output.value |> quantity_of(tusd_policy_id, tusd_asset_name)
            tusd_amount + tusd_total
          },
        )

  (tusd_total_in_outputs == tusd_borrowed)?
}

// Tests
fn get_borrow_spend_tx(
  borrow_output_tusd_amount: Int,
  borrow_outputs: Option<List<Output>>,
) {
  let loan_nft_policy_id = mock_policy_id(1)
  let collateral_validator_script_hash = mock_script_hash(2)
  let test_usd_policy_id = mock_policy_id(0)
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
          tusd_pool_hash: mock_script_hash(3),
          tusd_policy_id: test_usd_policy_id,
          tusd_asset_name: test_usd_asset_name,
          tusd_borrowed: 12,
          loan_nft_pid: loan_nft_policy_id,
          // $1.2 (per ADA)
          collateral_rate_in_lovelace: 1200000,
          collateral_asset: "ada",
          collateral_amount_in_lovelace,
          loan_term: 10000,
        },
      ),
      reference_script: None,
    }

  let borrow_key_hash = mock_pub_key_hash(0)
  let borrow_output =
    Output {
      address: Address {
        payment_credential: Script(borrow_key_hash),
        stake_credential: None,
      },
      // Borrowers should be given $12 USD as he provided an over-collaterized asset
      // of ADA in 15 ADA (normal - 10 ADA) @ $1.2 USD per ADA rate
      value: assets.merge(
        from_asset(
          test_usd_policy_id,
          test_usd_asset_name,
          borrow_output_tusd_amount,
        ),
        from_asset(loan_nft_policy_id, "BorrowNFT1", 1),
      ),
      datum: NoDatum,
      reference_script: None,
    }

  let more_outputs =
    when borrow_outputs is {
      Some(outputs) -> outputs
      None -> []
    }

  let tx =
    Transaction {
      ..placeholder,
      outputs: [collateral_validator_output, borrow_output, ..more_outputs],
    }

  liquidity_pool.spend(
    collateral_validator_script_hash,
    None,
    "",
    mock_utxo_ref(0, 0),
    tx,
  )
}

test test_borrow_spend_with_right_output() {
  get_borrow_spend_tx(12, None)
}

test test_borrow_spend_with_wrong_output() fail {
  get_borrow_spend_tx(15, None)
}

test test_borrow_spend_with_malicious_outputs() fail {
  let test_usd_policy_id = mock_policy_id(0)
  let test_usd_asset_name = "tUSD"
  let loan_nft_policy_id = mock_policy_id(1)
  let borrow_key_hash = mock_pub_key_hash(0)
  let malicious_output1 =
    Output {
      address: Address {
        payment_credential: Script(borrow_key_hash),
        stake_credential: None,
      },
      value: assets.merge(
        from_asset(test_usd_policy_id, test_usd_asset_name, 7),
        from_asset(loan_nft_policy_id, "BorrowNFT1", 1),
      ),
      datum: NoDatum,
      reference_script: None,
    }
  let malicious_output2 =
    Output {
      address: Address {
        payment_credential: Script(borrow_key_hash),
        stake_credential: None,
      },
      value: assets.merge(
        from_asset(test_usd_policy_id, test_usd_asset_name, 3),
        from_asset(loan_nft_policy_id, "BorrowNFT1", 1),
      ),
      datum: NoDatum,
      reference_script: None,
    }

  get_borrow_spend_tx(12, Some([malicious_output1, malicious_output2]))
}
