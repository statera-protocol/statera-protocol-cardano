use aiken/collection/dict
use aiken/crypto.{VerificationKeyHash}
use cardano/assets.{tokens}
use cardano/transaction.{OutputReference, Transaction}
use halalend/datums.{CollateralDatum}
use halalend/utils.{is_loan_term_end, signed_by}

pub type Action {
  Refund
  Liquidate
}

validator collateral_validator(admin: VerificationKeyHash) {
  spend(
    datum: Option<CollateralDatum>,
    redeemer: Action,
    _o: OutputReference,
    self: Transaction,
  ) {
    let Transaction { mint, validity_range, extra_signatories, .. } = self

    expect Some(CollateralDatum { collateral_nft_pid, loan_term, .. }) = datum

    when redeemer is {
      Refund -> {
        expect [Pair(_, quantity)] =
          mint |> tokens(collateral_nft_pid) |> dict.to_pairs

        quantity == -1
      }

      Liquidate -> and {
          is_loan_term_end(validity_range, loan_term),
          signed_by(extra_signatories, admin),
        }
    }
  }

  else(_) {
    fail
  }
}
