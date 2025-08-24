// import { deserializeDatum, mConStr } from "@meshsdk/core";
// import { blockchainProvider, collateralScriptIdx, collateralScriptTxHash, multiSigAddress, txBuilder, wallet1, wallet1Address, wallet1Collateral, wallet1Utxos } from "../setup.js";
// import { CollateralValidatorAddr } from "../CollateralValidator/validator.js";
// import { getLiqUtxo, getOracleUtxo, getPParamsUtxo } from "../utils.js";
// import { CollateralDatum } from "../types.js";

// const oracleUtxo = getOracleUtxo();
// const pParamsUtxo = getPParamsUtxo();
// const liqUtxo = getLiqUtxo();

// const allCollateralValidatorUtxos = await blockchainProvider.fetchAddressUTxOs(CollateralValidatorAddr);
// const collateralUtxos = allCollateralValidatorUtxos.filter(utxo => {
//   const plutusData = utxo.output.plutusData;
//   if (!plutusData) return false;
//   const datum = deserializeDatum<CollateralDatum>(plutusData);
//   return !!datum.fields[7];
// });

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
//     .spendingTxInReference(collateralScriptTxHash, collateralScriptIdx)
//     .spendingReferenceTxInInlineDatumPresent()
//     .spendingReferenceTxInRedeemerValue(mConStr(7, []))
//     .txOut(multiSigAddress, collateralUtxo.output.amount)
//     .readOnlyTxInReference(oracleUtxo.input.txHash, oracleUtxo.input.outputIndex)
//     .readOnlyTxInReference(pParamsUtxo.input.txHash, pParamsUtxo.input.outputIndex)
//     .readOnlyTxInReference(liqUtxo.input.txHash, liqUtxo.input.outputIndex)
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
