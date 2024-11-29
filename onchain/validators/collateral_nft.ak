use aiken/collection/dict
use aiken/collection/list
use aiken/crypto.{ScriptHash}
use cardano/address.{Script}
use cardano/assets.{PolicyId, quantity_of, tokens}
use cardano/transaction.{InlineDatum, Input, OutputReference, Transaction}
use halalend/datums.{CollateralDatum}

pub type Action {
  Mint
  Burn
}

validator collateral_nft(
  borrow_utxo: OutputReference,
  collateral_validator_hash: ScriptHash,
) {
  mint(redeemer: Action, _pid: PolicyId, self: Transaction) {
    let Transaction { inputs, outputs, mint, .. } = self

    when redeemer is {
      Mint -> True

      Burn -> {
        expect Some(collateral_input) =
          list.find(
            inputs,
            fn(input) {
              Script(collateral_validator_hash) == input.output.address.payment_credential
            },
          )

        expect InlineDatum(collateral_input_datum) =
          collateral_input.output.datum

        expect CollateralDatum {
          tusd_pool_hash,
          tusd_policy_id,
          tusd_asset_name,
          tusd_borrowed,
          collateral_nft_pid,
          ..
        } = collateral_input_datum

        expect [Pair(_, quantity)] =
          mint |> tokens(collateral_nft_pid) |> dict.to_pairs

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
    }
  }

  else(_) {
    fail
  }
}
