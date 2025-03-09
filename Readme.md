# Statera Protocol

![Statera Logo](URL_TO_LOGO) <!-- Replace URL_TO_LOGO with the actual link to your logo image -->

## About
Statera protocol is a lending and borrowing protocol.

The protocol works in a way that users deposit collateral and mint the protocol's stable asset, sUSD which they can trade in the secondary market.

Some of the features the protocol supports are:
- User account (with balance in ADA) on the protocol.
- Users can use different assets permitted in the protocol parameters as collateral.
- Users can increase collateral.
- Users can execute partial loan repayment.

**Note:** This is a zero interest lending and borrowing protocol. Only protocol usage fees will be charged.

## Codebase

### Onchain code
*Location:* `onchain/`

Onchain code is written in Aiken; Plutus V3.

To run the tests, you have to have Aiken 1.x.x installed. then `aiken c`.

### Off chain code (Fronted)
*Location:* `frontend/`

Have `npm` and `nodejs` installed.

Run `npm i` to install dependencies.

Run `npm run dev` to start the application.
