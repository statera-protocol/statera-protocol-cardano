- In Protocols parameter validator, use find_input from aiken/transaction instead of the custom one from halalend/utils
- Protocol usage fee and collateral assets units (policy id + asset name) of protocol parameters are not currently used in the protocol
- Protocol parameter validator hash and oracle validator hash are passed as parameters. Any user can pass a different hash and use as his own. Change them to use environment variables instead of parameters for security reasons or use suggestion in Emurgo

<!-- IMMEDIATE CHANGES -->
- User's loanNFTValidator script hash has to be stored somewhere so as to be reused during repayment:
    Store it in the collateral utxo. (Design decision: Validate that a reference script is being sent with the utxo)
- In utils.ak, functions to find by hash should take either scripthash or verificationKeyHash instead of just script hash

# Suggestions
- We can mint an identfier token too to the deposit utxo in collateral validator so as to differentiate between allowed utxos and non-allowed ones.
- Use another UTxO as txInCollateral instead of collateral from user's wallet
