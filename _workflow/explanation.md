# Halalend Protocol

## Validators

### Protocol Parameter Validator (spend)
- Expect some datum
- Expect some input
- Tx should be signed by the admin

### Liquidity Pool Validator (spend)
- To spend from the liquidity pool, the admin has to sign the transaction

### Collateral NFT Validator (burn)
- Finds an input containing a datum containing the stable coin data, `tUSD`, and the Loan NFT policy id (the input was locked to the `collateral` validator)
- Expect collateral nft to be provided to be burned (NOTE!: this is a linked validation. Burning of the NFT is checked in the `collateral` validator for `Refund`)
- Check if an input is provided with the correct amount of ada to refund
- Check if there is an output going to the liquidity pool and it contains the right amount of `tUSD`

### Collateral Validator (spend)
- Refund:
  - Make sure the NFT with the policy id in the datum is being burned
- Liquidate:
  - Tx should be signed by admin
  - The loan_term should have ended
