- In Protocols parameter validator, use find_input from aiken/transaction instead of the custom one from halalend/utils
- Protocol usage fee and collateral assets units (policy id + asset name) of protocol parameters are not currently used in the protocol
- Protocol parameter validator hash and oracle validator hash are passed as parameters. Any user can pass a different hash and use as his own. Change them to use environment variables instead of parameters for security reasons or use suggestion in Emurgo

- Depending on either single loan position or multiple loan positions, make deposit use withrawDeposit or partialWithdrawal

<!-- RECOMMENDED CHANGES -->
- Confirm only one outputs and inputs of user balance and collateral utxos: Use list.filter and confirm only one element.
