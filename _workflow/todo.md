- In Protocols parameter validator, use find_input from aiken/transaction instead of the custom one from halalend/utils
- Protocol usage fee and collateral assets units (policy id + asset name) of protocol parameters are not currently used in the protocol
- Protocol parameter validator hash and oracle validator hash are passed as parameters. Any user can pass a different hash and use as his own. Change them to use environment variables instead of parameters for security reasons or use suggestion in Emurgo

- Depending on either single loan position or multiple loan positions, make deposit use withrawDeposit or partialWithdrawal

<!-- IMMEDIATE CHANGES -->
.....
- In mint loan validator, and withdrawal in collateral validator, find the output whose datum corresponds not just output by hash so as to avoid conflicting outputs going to same hash but with different datum.
- Do like the above for this output: Line 147, `expect Some(collateral_output)`, ... `let is_borrow_input_to_collateral_validator =`

# Suggestions
- We can mint an identfier token too to the deposit utxo in collateral validator so as to differentiate between allowed utxos and non-allowed ones.
- Use another UTxO as txInCollateral instead of collateral from user's wallet
