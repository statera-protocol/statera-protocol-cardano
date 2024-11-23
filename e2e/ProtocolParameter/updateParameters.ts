import { mConStr0 } from "@meshsdk/core";
import { blockchainProvider, txBuilder, scriptAddr, parameterizedScript, wallet1Address, wallet1Collateral, wallet1VK, wallet1Utxos, wallet1 } from "./setup.js";

const lockedUTxosWithDatum = await blockchainProvider.fetchAddressUTxOs(scriptAddr);
console.log(lockedUTxosWithDatum);
const lockedUTxoWithDatum = lockedUTxosWithDatum[0];

// throw error for an invalid utxo
if (!lockedUTxoWithDatum) {
    throw new Error("No utxos to unlock");
}

const ProtocolParametersDatum = mConStr0([
    15000,
    1000000,
    50000,
    ["ada", "iUSD", "halalend", "hosky", "testing"],
    14 * 24 * 60 * 60 * 1000,
]);

const updateParamtersTx = await txBuilder
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
    .txIn(
        wallet1Utxos[0].input.txHash,
        wallet1Utxos[0].input.outputIndex,
        wallet1Utxos[0].output.amount,
        wallet1Utxos[0].output.address
    )
    .txOut(scriptAddr, [{ unit: "lovelace", quantity: '2000000' }])
    .txOutInlineDatumValue(ProtocolParametersDatum)
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

const signedTx = await wallet1.signTx(updateParamtersTx);
const txHash = await wallet1.submitTx(signedTx);

console.log('Updated parameters tx hash:', txHash);
