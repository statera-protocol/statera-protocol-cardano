# Borrow

- User asks to borrow a specific amount of a specific asset. The asset is matched with the amount of ADA the user is supposed to deposit.
- The ADA the user is supposed to deposit is released from the user's wallet as a `borrow utxo`.

- The NFT Minting validator validates the `borrow utxo`, calculates the rate using the `oracle dex ref input` and `protocol parameters ref input`, and approve if loan is allowed to be borrowed while minting an NFT as borrower's loan position (with a unique policy ID).
- When the NFT Minting validation is successful, the amount that the user requested to borrow is sent to the borrower's address using the `Lending protocol validator` signed by the admin.

- validate when spending from the liquidity pool during borrow that the requested funds is going to the borrower's address



## Off Chain
- First transaction:
  - User approves a utxo from his wallet

- Second transaction:
  - Minting and sending of NFT position and requested loan to the user

- Second tx flow:




# Others
- NFT Minting Validator: It mints using a onetime minting policy. The `borrow utxo` is provided as an argument and confirmed if it is there as an input during minting. During burn, anyone can burn provided that the NFT with that particular policy ID is provided.
- Linking the `collateral utxo` and the NFT: The policy ID of the NFT is locked in a datum with the `collateral utxo` on the `collateral validator`.
CollateralValidatorDatum will contain nftpolicyid, loanterm, amountborrowed, amountprovidedascollateral, e.t.c.
- During repayment, in the `collater validator` there is going to be a verification if an nft with the policy ID in the datum is provided as an input to be burned.
