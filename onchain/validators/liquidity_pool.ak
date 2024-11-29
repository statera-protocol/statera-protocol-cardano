use aiken/collection/list
use aiken/crypto.{VerificationKeyHash}
use cardano/transaction.{OutputReference, Transaction}

validator liquidity_pool(admin: VerificationKeyHash) {
  spend(_d: Option<Data>, _r: Data, _o: OutputReference, self: Transaction) {
    let Transaction { extra_signatories, .. } = self

    extra_signatories |> list.has(admin)
  }

  else(_) {
    fail
  }
}
