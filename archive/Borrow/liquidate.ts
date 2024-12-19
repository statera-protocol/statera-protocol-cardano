import { mConStr0, mConStr1, SLOT_CONFIG_NETWORK, unixTimeToEnclosingSlot } from "@meshsdk/core";
import { blockchainProvider, txBuilder, wallet1, wallet1Address, wallet1Collateral, wallet1Utxos } from "../setup.js";
import { collateralValidatorAddress, collateralValidatorScript, oracleUtxo, oracleUtxoForLiquidation, protocolParametersUtxo } from "./setup.js";

if (!oracleUtxo) {
    throw new Error('Oracle UTxO not found!');
}
if (!oracleUtxoForLiquidation) {
    throw new Error('Oracle UTxO For Liquidation not found!');
}

const collateralUtxo = (await blockchainProvider.fetchAddressUTxOs(collateralValidatorAddress))[0];

const invalidBefore = unixTimeToEnclosingSlot(
    (Date.now() - 80000),
    SLOT_CONFIG_NETWORK.preprod,
);

// Liquidate when liquidation threshold reached
// const unsignedTx1 = await txBuilder
//     .spendingPlutusScriptV3()
//     .txIn(
//         collateralUtxo.input.txHash,
//         collateralUtxo.input.outputIndex,
//         collateralUtxo.output.amount,
//         collateralUtxo.output.address,
//     )
//     .txInScript(collateralValidatorScript)
//     .spendingReferenceTxInInlineDatumPresent()
//     .spendingReferenceTxInRedeemerValue(mConStr1([]))
//     .txOut(wallet1Address, collateralUtxo.output.amount)
//     .readOnlyTxInReference(oracleUtxoForLiquidation.input.txHash, oracleUtxoForLiquidation.input.outputIndex)
//     .readOnlyTxInReference(protocolParametersUtxo.input.txHash, protocolParametersUtxo.input.outputIndex)
//     .txInCollateral(
//         wallet1Collateral.input.txHash,
//         wallet1Collateral.input.outputIndex,
//         wallet1Collateral.output.amount,
//         wallet1Collateral.output.address,
//     )
//     .selectUtxosFrom(wallet1Utxos)
//     .changeAddress(wallet1Address)
//     .complete()

// const signedTx1 = await wallet1.signTx(unsignedTx1);
// const txHash1 = await wallet1.submitTx(signedTx1);

// console.log('Liquidation by low price tx hash:', txHash1);


// Liquidate by deadline reached
const unsignedTx2 = await txBuilder
    .spendingPlutusScriptV3()
    .txIn(
        collateralUtxo.input.txHash,
        collateralUtxo.input.outputIndex,
        collateralUtxo.output.amount,
        collateralUtxo.output.address,
    )
    .txInScript(collateralValidatorScript)
    .spendingReferenceTxInInlineDatumPresent()
    .spendingReferenceTxInRedeemerValue(mConStr1([]))
    .txOut(wallet1Address, collateralUtxo.output.amount)
    .readOnlyTxInReference(oracleUtxo.input.txHash, oracleUtxo.input.outputIndex)
    .readOnlyTxInReference(protocolParametersUtxo.input.txHash, protocolParametersUtxo.input.outputIndex)
    .txInCollateral(
        wallet1Collateral.input.txHash,
        wallet1Collateral.input.outputIndex,
        wallet1Collateral.output.amount,
        wallet1Collateral.output.address,
    )
    .invalidBefore(invalidBefore)
    .selectUtxosFrom(wallet1Utxos)
    .changeAddress(wallet1Address)
    .complete()

const signedTx2 = await wallet1.signTx(unsignedTx2);
const txHash2 = await wallet1.submitTx(signedTx2);

console.log('Liquidation deadline tx hash:', txHash2);
