// import { mConStr0, mConStr1 } from "@meshsdk/core";
// import { multiSigAddress, multiSigCbor, multiSigUtxos, StPoolNftName, txBuilder, wallet1, wallet1Address, wallet1Collateral, wallet1Utxos, wallet2 } from "../setup.js";
// import { batchingAsset, BatchingValidatorHash, PoolValidatorAddr, PoolValidatorHash, PoolValidatorScript } from "./validators.js";
// import { getPParamsUtxo } from "../utils.js";

// const pParamsUtxo = getPParamsUtxo();

// const PoolDatum = mConStr0([
//     mConStr1([BatchingValidatorHash])
// ]);

// const poolAssetUnit = batchingAsset.unit;

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
//     .mint("1", PoolValidatorHash, StPoolNftName)
//     .mintingScript(PoolValidatorScript)
//     .mintRedeemerValue("")
//     .txOut(PoolValidatorAddr, [
//         { unit: poolAssetUnit, quantity: "1000000000" },
//         { unit: PoolValidatorHash + StPoolNftName, quantity: "1" }
//     ])
//     .txOutInlineDatumValue(PoolDatum)
//     // send back some UTxO to multisig
//     .txOut(multiSigAddress, [{ unit: "lovelace", quantity: "20000000" }])
//     .readOnlyTxInReference(pParamsUtxo.input.txHash, pParamsUtxo.input.outputIndex)
//     .txInCollateral(
//         wallet1Collateral.input.txHash,
//         wallet1Collateral.input.outputIndex,
//         wallet1Collateral.output.amount,
//         wallet1Collateral.output.address,
//     )
//     .changeAddress(wallet1Address)
//     .selectUtxosFrom(wallet1Utxos)
//     .setFee("1184029")
//     .complete()

// const signedTx1 = await wallet1.signTx(unsignedTx, true);
// const signedTx2 = await wallet2.signTx(signedTx1, true);

// const txHash = await wallet1.submitTx(signedTx2);
// console.log("Create pool:", txHash);
