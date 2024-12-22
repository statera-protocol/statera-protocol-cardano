# Halalend Protocol V1.1 Specification


## 1. Overview

Halalend lending protocol mimics all the features of the currently existing lending protocols on
Cardano except the interest paid by borrowers on loan repayment, and the fact that the protocol's
own stable coin is going to use to issue loans. Loans are repaid at zero
interest rate.


## 2. Architecture

- ### Borrow:

There are 4 contracts in the borrow feature:

- Loan NFT Validator: Validates the protocol parameters, oracle rates, and minting of the loan NFT
- Collateral validator: Locks a collateral utxo that represent the collateral of the borrower.
- Mint Loan Validator: Responsible for minting the stable coin (as loans)
- Protocol Parameter Validator: Returns reference transaction input with the protocol parameters

- ### Repayment:

There are 3 contracts in the add liquidity feature:

- Loan NFT Validator: Validates the conditions necessary for the repayment of loan and burning of the loan NFT
- Collateral validator: Validates that the loan UTxO has satisfied the terms to be returned back to the loan NFT holder
- Mint Loan Validator: Responsible for burning the stable coin (which is the repaid loan)

- ### Liquidation:

There are 2 contracts in the add liquidity feature:

- Collateral validator: Validates the condition necessary for liquidation; checks oracle rate and liquidation ratio
- Protocol Parameter Validator: Returns reference transaction input with the protocol parameters


## 3. Specification

### 3.1 Actors

- Borrower: An entity who wants to borrow a loan
- Repayer: An entity who wants to repay a loan. This is the entity in posession of the loan NFT
- Liquidator: The system/bot that monitors for liquidation

### 3.2 Tokens

- Stable coin Token: Represents the stable coin as loan
    - CurrencySymbol: Mint Loan Validator
    - TokenName: Defined in MintLoanValidator
- Loan NFT: Represents the amount of loan a user has taken
    - CurrencySymbol: Loan NFT Validator
    - TokenName: Defined in LoanNFTValidator

### 3.3 Smart Contract

#### 3.3.1 Loan NFT Validator
Loan NFT Validator validates the conditions necessary for minting and burning a loan NFT; which literally means the condition necessary for taking and repaying a loan
##### 3.3.1.1 Parameter
- _borrow_utxo_: A UTxO from the wallet of the loan `Borrower`
- _collateral_validator_hash_: The script hash of the collateral validator
- _protocol_parameters_hash_: The script hash of the protocol parameter validator
- _oracle_hash_: The script hash of the script the oracle UTxO is stored in
##### 3.3.1.2 Datum
None
##### 3.3.1.3 Redeemer
- Mint: To mint loan NFT
- Burn: To burn loan NFT
##### 3.3.1.4 Validation
- Mint:
    - expect that there is an output UTxO to the collateral validator; and the UTxO has a datum type specified in the Collatateral Validator
    - validate that the loan stable coin mint quantity is valid
    - vaidate that the exact collateral amount provided by the user is going to the collateral validator
    - validate that the loan amount requested by the `Borrower` is the exact amount in the collateral validator datum
    - validate that the loan NFT policy ID is the exact same in the collateral validator datum
    - validate that the loan NFT to be minted is 1
    - validate that the `Borrower` receives the loan NFT
    - validate that the requested loan amount relative to the collateral provided abides by the oracle rate and the minimum collateral ratio
    - validate that the rate in the collateral validator datum is the same as the oracle rate at the time of borrowing
    - validate that the loan amount is greater than or equal to the minimum loan amount
    - validate that the collateral asset provided by the `Borrower` is allowed in the protocol
- Burn:
    - validate that the loan NFT is being burned
    - validate that the loan amount being refunded is being burned and is the same amount that was borrowed
    - validate that the collateral is going to the provider of the loan NFT

#### 3.3.2 Collateral Validator
Collateral Validator is a lock script that locks a UTxO containing the collateral that a `Borrower` provided.
The locked collateral is provided as a transaction input during liquidation or when a `Borrower`
wants to repay their borrowed loan
##### 3.3.2.1 Parameter
- _protocol_parameters_hash_: The script hash of the protocol parameter validator
- _oracle_hash_: The script hash of the script the oracle UTxO is stored in
- _liquidated_funds_collector_hash_: The script hash of the multiSig address the liquidated funds go to.
##### 3.3.2.2 Datum
- CollateralDatum:
    - tusd_pool_hash: `ScriptHash`; the script hash of Mint Loan Validator
    - tusd_policy_id: `PolicyId`; the policy ID of Mint Loan Validator (in this model, same as the tusd_pool_hash)
    - tusd_asset_name: `AssetName`; the asset name of the stable coin (in hex) that the Mint Loan Validator mints
    - tusd_borrowed: `Int`; the amount of loan borrowed
    - loan_nft_pid: `PolicyId`; the loan NFT policy ID
    - collateral_rate_in_lovelace: `Int`; the oracle rate at the time the loan was borrowed (multiplied by `1_000_000` for precision)
    - collateral_asset: `ByteArray`; The collateral asset name provided by the `Borrower` (in hex)
    - collateral_amount_in_lovelace: `Int`; The collateral amount provided by the `Borrower` (multiplied by `1_000_000` for precision)
##### 3.3.2.3 Redeemer
- Refund
- Liquidate
##### 3.3.2.4 Validation
- Refund: the redeemer will allow spending the collateral UTxO to send back the collateral to the loan NFT holder
    - validate that the loan NFT is burned
- Liquidate: the redeemer will allow spending the UTxO if the liquidation threshold is reached
    - validate that the UTxO can be spent if the liquidation threshold is reached
    - validate the the value in the liquidated collateral UTxO will go to `liquidated_funds_collector_hash` as specified in the validator parameter

#### 3.3.3 Mint Loan Validator
Mint Loan Validator is responsible for minting and burning the stable coin provided as loan to the `Borrower`
##### 3.3.3.1 Parameter
- _collateral_validator_hash_: The script hash of the collateral validator
##### 3.3.3.2 Datum
None
##### 3.3.3.3 Redeemer
- GetLoan
- RepayLoan
##### 3.3.3.4 Validation
- GetLoan:
    - validate that the validator policy ID and pool hash is the same as that in the collateral validator datum
    - validate that the asset name is valid
    - validate that the mint quantity is valid
- RepayLoan:
    - validate that the quantity of to be burned is the same as the one in collateral validator datum

#### 3.3.4 Protocol Parameter Validator
Protocol Parameter Validator is responsible for providing the parameters of `Halalend protocol` like the MCR, and MLT. UTxO reference input from this validator is passed into other validator to validate protocol parameters
##### 3.3.4.1 Parameter
- _admin_: the verification key hash of a protocol maintainer/admin
##### 3.3.4.2 Datum
- ProtocolParametersDatum:
    - min_collateral_ratio: `Int`; The MCR (Minimum Collateral Ratio) of the protocol
    - min_liquidation_threshold: `Int`; The MLT (Minimum Liquidation Threshold)
    - min_loan_amount: `Int`; The minimum loan amount a `Borrower` can borrow
    - protocol_usage_fee: `Int`; The protocol usage fee
    - collateral_assets: `List<ByteArray>`; The list of allowed collateral assets in the protocol
##### 3.3.4.3 Redeemer
None
##### 3.3.4.4 Validation
- validate that the spend transaction is signed by the protocol's admin verification key hash provided in the vaidator parameter

### 3.4 Transaction

#### 3.4.1 Borrow
`Borrower` borrows from the protocol.<br /><br />This requires the `Borrower` to provide his collateral value as input UTxO.
Transaction structure:
- Inputs:
    - _borrow_utxo_ from `Borrower`
    - Reference UTxO from the `Protocol Parameter Validator`
    - Reference UTxO from the oracle for rates
- Mint:
    - Loan NFT Minting Policy:
        - Redeemer: Mint
        - Value:
            - 1 Loan NFT Asset
    - Mint Loan Minting Policy:
        - Redeemer: GetLoan
        - Value:
            - Stable coin tokens (loan amount)
- Outputs:
    - Loan UTxO:
        - Address: `Borrower` wallet address
        - Value:
            - Loan Amount (in stable coin tokens)
            - 1 Loan NFT Asset
    - Collateral UTxO:
        - Address: Collateral Validator address
        - Datum:
            - refer to `CollateralDatum` at `3.3.2.2`
        - Value:
            - Collateral amount provided by the `Borrower`
    - Fees UTxO (_not implemented/included yet_)

#### 3.4.2 Repayment
`Repayer` repays borrowed loan
Transaction structure:
- Inputs:
    - Collateral UTxO linked to the loan NFT the `Repayer` has on his wallet
    - Loan NFT
    - Stable coin tokens to be repaid
- Spend:
    - Collateral Validator:
        - spends collateral UTxO
- Mint:
    - Loan NFT Minting Policy:
        - Redeemer: Burn
        - Value:
            - -1 Loan NFT Asset
    - Mint Loan Minting Policy:
        - Redeemer: RepayLoan
        - Value:
            - minus (-) Stable coin tokens (loan amount)
- Outputs:
    - Repayer UTxO:
        - Address: `Repayer` wallet address
        - Value:
            - collateral UTxO value
    - Fees UTxO (_not implemented/included yet_)

#### 3.4.3 Liquidation
Liquidates the `Borrower`'s collateral if it reaches or goes below the `minimum liquidation threshold`. The `Liquidator` monitors all collateral UTxOs at time intervals to spend/unlock the ones that satisfies the liquidation condition.
Transaction structure:
- Inputs:
    - Collateral UTxO
    - Reference UTxO from the `Protocol Parameter Validator`
    - Reference UTxO from the oracle for rates
- Spend:
    - Collateral Validator:
        - spends collateral UTxO and sends it to `_liquidated_funds_collector_hash_`
- Outputs:
    - Liquidated UTxO:
        - Address: protocol's multisig address (`_liquidated_funds_collector_hash_`)
        - Value:
            - collateral UTxO value
    - Fees UTxO (_not implemented/included yet_)
