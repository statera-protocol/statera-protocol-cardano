import { blockchainProvider, txBuilder, scriptAddr, parameterizedScript, wallet1Address, wallet1Collateral, wallet1VK, wallet1Utxos, wallet1 } from "../../setup.js";

const lockedUTxosWithDatum = await blockchainProvider.fetchAddressUTxOs(scriptAddr);
console.log(lockedUTxosWithDatum);
const lockedUTxoWithDatum = lockedUTxosWithDatum[0];

// throw error for an invalid utxo
if (!lockedUTxoWithDatum) {
    throw new Error("No utxos to unlock");
}

const unlockWithDatumTx = await txBuilder
    .spendingPlutusScript('V3')
    .txIn(
        lockedUTxoWithDatum.input.txHash,
        lockedUTxoWithDatum.input.outputIndex,
        lockedUTxoWithDatum.output.amount,
        scriptAddr
    )
    .spendingReferenceTxInInlineDatumPresent()
    .spendingReferenceTxInRedeemerValue("")
    .txInScript(parameterizedScript)
    .txOut(wallet1Address, [])
    .txInCollateral(
        wallet1Collateral.input.txHash,
        wallet1Collateral.input.outputIndex,
        wallet1Collateral.output.amount,
        wallet1Collateral.output.address,
    )
    .requiredSignerHash(wallet1VK)
    .changeAddress(wallet1Address)
    .selectUtxosFrom(wallet1Utxos)
    .complete();

const signedTx = await wallet1.signTx(unlockWithDatumTx);
const txHash = await wallet1.submitTx(signedTx);

console.log('Unlock_with_datum tx hash:', txHash);
