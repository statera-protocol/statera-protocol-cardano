# Protocol Parameter Validator

## How it works:
- lock a utxo with a datum to the protocol parameter validator
- only the admin can spend the utxo (verified using the admin phk as a validator parameter) to create a new utxo so as to update the protocol parameter

### Caveat(s)/Security issue(s):
    - the admin can lock more than one utxo
    - other users can lock utxos
### Possible solution(s) to caveats(s):
    - we make sure that the admin spends the previous utxo if available before creating a new one
    - validate that the utxo was locked by the admin before using it on offchain code
