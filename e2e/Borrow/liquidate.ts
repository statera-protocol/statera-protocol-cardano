import { mConStr0, mConStr1, SLOT_CONFIG_NETWORK, unixTimeToEnclosingSlot } from "@meshsdk/core";
import { blockchainProvider, multiSigAddress, txBuilder, wallet1, wallet1Address, wallet1Collateral, wallet1Utxos } from "../setup.js";
import { collateralValidatorAddress, collateralValidatorScript, oracleUtxo, oracleUtxoForLiquidation, protocolParametersUtxo } from "./setup.js";

if (!oracleUtxo) {
    throw new Error('Oracle UTxO not found!');
}
if (!oracleUtxoForLiquidation) {
    throw new Error('Oracle UTxO For Liquidation not found!');
}

const collateralUtxos = await blockchainProvider.fetchAddressUTxOs(collateralValidatorAddress);
const collateralUtxo = collateralUtxos[collateralUtxos.length - 1];

// Liquidate when liquidation threshold reached
const unsignedTx1 = await txBuilder
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
    .txOut(multiSigAddress, collateralUtxo.output.amount)
    .readOnlyTxInReference(oracleUtxoForLiquidation.input.txHash, oracleUtxoForLiquidation.input.outputIndex)
    // .readOnlyTxInReference(oracleUtxo.input.txHash, oracleUtxo.input.outputIndex)
    .readOnlyTxInReference(protocolParametersUtxo.input.txHash, protocolParametersUtxo.input.outputIndex)
    .txInCollateral(
        wallet1Collateral.input.txHash,
        wallet1Collateral.input.outputIndex,
        wallet1Collateral.output.amount,
        wallet1Collateral.output.address,
    )
    .selectUtxosFrom(wallet1Utxos)
    .changeAddress(wallet1Address)
    .complete()

const signedTx1 = await wallet1.signTx(unsignedTx1);
const txHash1 = await wallet1.submitTx(signedTx1);

console.log('Liquidation by low price tx hash:', txHash1);
