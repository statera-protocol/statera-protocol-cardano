// import { mConStr1 } from "@meshsdk/core";
// import { blockchainProvider, multiSigAddress, txBuilder, wallet1, wallet1Address, wallet1Collateral, wallet1Utxos } from "../setup.js";
// import { CollateralValidatorAddr, CollateralValidatorScript } from "../CollateralValidator/validator.js";
// import { pParamsUtxo } from "../utils.js";

// const collateralUtxos = await blockchainProvider.fetchAddressUTxOs(CollateralValidatorAddr);
// const collateralUtxo = collateralUtxos[0];

// // Liquidate when liquidation threshold reached
// const unsignedTx1 = await txBuilder
//     .spendingPlutusScriptV3()
//     .txIn(
//         collateralUtxo.input.txHash,
//         collateralUtxo.input.outputIndex,
//         collateralUtxo.output.amount,
//         collateralUtxo.output.address,
//     )
//     .txInScript(CollateralValidatorScript)
//     .spendingReferenceTxInInlineDatumPresent()
//     .spendingReferenceTxInRedeemerValue(mConStr1([]))
//     .txOut(multiSigAddress, collateralUtxo.output.amount)
//     .readOnlyTxInReference(oracleUtxoForLiquidation.input.txHash, oracleUtxoForLiquidation.input.outputIndex)
//     .readOnlyTxInReference(pParamsUtxo.input.txHash, pParamsUtxo.input.outputIndex)
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
// const txHash = await wallet1.submitTx(signedTx1);

// console.log('Liquidation tx hash:', txHash);
