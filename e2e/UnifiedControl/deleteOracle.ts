import { mConStr3 } from "@meshsdk/core";
import { multiSigAddress, multiSigCbor, multiSigUtxos, StOracleAssetName, txBuilder, wallet1, wallet1Address, wallet1Collateral, wallet1Utxos, wallet2 } from "../setup.js";
import { UnifiedControlValidatorHash, UnifiedControlValidatorScript } from "./validator.js";
import { getOracleUtxo } from "../utils.js";

const oracleUtxo = getOracleUtxo();

if (!multiSigCbor) {
    throw new Error("multisig cbor doesn't exist");
}

const unsignedTx = await txBuilder
    .spendingPlutusScriptV3()
    .txIn(
        oracleUtxo.input.txHash,
        oracleUtxo.input.outputIndex,
        oracleUtxo.output.amount,
        oracleUtxo.output.address,
    )
    .txInScript(UnifiedControlValidatorScript)
    .spendingReferenceTxInInlineDatumPresent()
    .spendingReferenceTxInRedeemerValue(mConStr3([]))
    .mintPlutusScriptV3()
    .mint("-1", UnifiedControlValidatorHash, StOracleAssetName)
    .mintingScript(UnifiedControlValidatorScript)
    .mintRedeemerValue(mConStr3([]))
    .txIn(
        multiSigUtxos[0].input.txHash,
        multiSigUtxos[0].input.outputIndex,
        multiSigUtxos[0].output.amount,
        multiSigUtxos[0].output.address,
    )
    .txInScript(multiSigCbor)
    // send back multisig value to multisig
    .txOut(multiSigAddress, multiSigUtxos[0].output.amount)
    .txInCollateral(
        wallet1Collateral.input.txHash,
        wallet1Collateral.input.outputIndex,
        wallet1Collateral.output.amount,
        wallet1Collateral.output.address,
    )
    .changeAddress(wallet1Address)
    .selectUtxosFrom(wallet1Utxos)
    .setFee("503250")
    .complete()

const signedTx1 = await wallet1.signTx(unsignedTx, true);
const signedTx2 = await wallet2.signTx(signedTx1, true);

const txHash = await wallet1.submitTx(signedTx2);
console.log("Delete Oracle tx hash:", txHash);
