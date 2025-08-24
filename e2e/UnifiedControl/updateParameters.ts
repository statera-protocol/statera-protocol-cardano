import { mConStr0, mConStr1 } from "@meshsdk/core";
import { assetObject, multiSigAddress, multiSigCbor, multisigHash, multiSigUtxos, StPparamsAssetName, txBuilder, wallet1, wallet1Address, wallet1Collateral, wallet1Utxos, wallet1VK, wallet2 } from "../setup.js";
import { UnifiedControlValidatorAddr, UnifiedControlValidatorHash, UnifiedControlValidatorScript } from "./validator.js";
import { st_asset } from "../StMinting/validator.js";
import { getPParamsUtxo } from "../utils.js";

const pParamsUtxo = getPParamsUtxo();

const collateral_assets = [
    mConStr0([
        mConStr0([]),
        assetObject.ada.policy,
        assetObject.ada.name,
    ]),
];

const swappable_assets = [
    mConStr0([
        mConStr1([]),
        assetObject.USDM.policy,
        assetObject.USDM.name,
    ]),
    mConStr0([
        mConStr1([]),
        assetObject.iUSD.policy,
        assetObject.iUSD.name,
    ]),
];

const ProtocolParametersDatum = mConStr1([
    80,
    150,
    120,
    10,
    2,
    st_asset,
    collateral_assets,
    swappable_assets,
    [wallet1VK],
    multisigHash,
]);

if (!multiSigCbor) {
    throw new Error("multisig cbor doesn't exist");
}

const unsignedTx = await txBuilder
    .spendingPlutusScriptV3()
    .txIn(
        pParamsUtxo.input.txHash,
        pParamsUtxo.input.outputIndex,
        pParamsUtxo.output.amount,
        pParamsUtxo.output.address,
    )
    .txInScript(UnifiedControlValidatorScript)
    .spendingReferenceTxInInlineDatumPresent()
    .spendingReferenceTxInRedeemerValue(mConStr1([]))
    .txIn(
        multiSigUtxos[0].input.txHash,
        multiSigUtxos[0].input.outputIndex,
        multiSigUtxos[0].output.amount,
        multiSigUtxos[0].output.address,
    )
    .txInScript(multiSigCbor)
    .txOut(UnifiedControlValidatorAddr, [{ unit: UnifiedControlValidatorHash + StPparamsAssetName, quantity: "1" }])
    .txOutInlineDatumValue(ProtocolParametersDatum)
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
    .setFee("1119825")
    .complete()

const signedTx1 = await wallet1.signTx(unsignedTx, true);
const signedTx2 = await wallet2.signTx(signedTx1, true);

const txHash = await wallet1.submitTx(signedTx2);
console.log("Update Protocol Parameters tx hash:", txHash);
