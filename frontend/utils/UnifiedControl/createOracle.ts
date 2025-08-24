// import { mConStr0 } from "@meshsdk/core";
// import { assetObject, multiSigAddress, multiSigCbor, multiSigUtxos, StOracleAssetName, txBuilder, wallet1, wallet1Address, wallet1Collateral, wallet1Utxos, wallet2 } from "../setup.js";
// import { UnifiedControlValidatorAddr, UnifiedControlValidatorHash, UnifiedControlValidatorScript } from "./validator.js";

// const OracleDatum = mConStr0([[
//   mConStr0([
//     assetObject.ada.unit,
//     24000000,
//     20000000,
//   ]),
//   mConStr0([
//     assetObject.hosky.unit,
//     20000000,
//     1000000,
//   ]),
// ]]);

// if (!multiSigCbor) {
//     throw new Error("multisig cbor doesn't exist");
// }

// const unsignedTx = await txBuilder
//     .txIn(
//         multiSigUtxos[0].input.txHash,
//         multiSigUtxos[0].input.outputIndex,
//         multiSigUtxos[0].output.amount,
//         multiSigUtxos[0].output.address,
//     )
//     .txInScript(multiSigCbor)
//     .mintPlutusScriptV3()
//     .mint("1", UnifiedControlValidatorHash, StOracleAssetName)
//     .mintingScript(UnifiedControlValidatorScript)
//     .mintRedeemerValue(mConStr0([]))
//     .txOut(UnifiedControlValidatorAddr, [{ unit: UnifiedControlValidatorHash + StOracleAssetName, quantity: "1" }])
//     .txOutInlineDatumValue(OracleDatum)
//     // send back multisig value to multisig
//     .txOut(multiSigAddress, multiSigUtxos[0].output.amount)
//     .txInCollateral(
//         wallet1Collateral.input.txHash,
//         wallet1Collateral.input.outputIndex,
//         wallet1Collateral.output.amount,
//         wallet1Collateral.output.address,
//     )
//     .changeAddress(wallet1Address)
//     .selectUtxosFrom(wallet1Utxos)
//     .setFee("1085645")
//     .complete()

// const signedTx1 = await wallet1.signTx(unsignedTx, true);
// const signedTx2 = await wallet2.signTx(signedTx1, true);

// const txHash = await wallet1.submitTx(signedTx2);
// console.log("Create oracle tx hash:", txHash);
