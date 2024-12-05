# Halalend Protocol

## Validators

### Protocol Parameter Validator (spend)
- Expect some datum
- Expect some input
- Tx should be signed by the admin

### Liquidity Pool Validator (spend)
- To spend from the liquidity pool, the admin has to sign the transaction

### Collateral NFT Validator (mint) <- In progress
- Extract collateral_validator datum information
- Find an input of the oracle dex by the script hash
- Find the borrow input
- Find the borrow output that has the same address as the borrow input (Also validating that the borrowed funds will go to the provider of value)
- Get the lovelace (ada) and usd quantity of both the oracle input and borrow input and outputs.
- Find the borrow input's output and make sure it's going to the collateral validator *
- Extract the protocol parameters datum information
- Calculate the 100% percent value of the collateral using the mcr
- Calculate the borrow rate and oracle rate and make sure the rate is valid (this also validates the mcr) *
- use the min_loan_amount to determine if the loan is valid *
- use the loan_term to determine if the loan_term is valid *

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
