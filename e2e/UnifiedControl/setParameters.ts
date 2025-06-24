import { mConStr0, mConStr1, stringToHex } from "@meshsdk/core";
import { alwaysSuccessMintValidatorHash, multiSigAddress, multiSigCbor, multisigHash, multiSigUtxos, StPparamsAssetName, StStableAssetName, txBuilder, wallet1, wallet1Address, wallet1Collateral, wallet1Utxos, wallet1VK, wallet2 } from "../setup.js";
import { UnifiedControlValidatorAddr, UnifiedControlValidatorHash, UnifiedControlValidatorScript } from "./validator.js";
import { MintStValidatorHash } from "../StMinting/validator.js";

const st_asset = mConStr0([
    mConStr1([]),
    MintStValidatorHash,
    StStableAssetName,
]);

const collateral_assets = [
    mConStr0([
        mConStr0([]),
        "",
        stringToHex("lovelace"),
    ]),
    mConStr0([
        mConStr1([]),
        alwaysSuccessMintValidatorHash,
        stringToHex("iUSD"),
    ]),
    mConStr0([
        mConStr0([]),
        alwaysSuccessMintValidatorHash,
        stringToHex("hosky"),
    ]),
];

const swappable_assets = [
    mConStr0([
        mConStr1([]),
        alwaysSuccessMintValidatorHash,
        stringToHex("usdm"),
    ]),
];

const ProtocolParametersDatum = mConStr1([
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
    .txIn(
        multiSigUtxos[0].input.txHash,
        multiSigUtxos[0].input.outputIndex,
        multiSigUtxos[0].output.amount,
        multiSigUtxos[0].output.address,
    )
    .txInScript(multiSigCbor)
    .mintPlutusScriptV3()
    .mint("1", UnifiedControlValidatorHash, StPparamsAssetName)
    .mintingScript(UnifiedControlValidatorScript)
    .mintRedeemerValue(mConStr1([]))
    .txOut(UnifiedControlValidatorAddr, [{ unit: UnifiedControlValidatorHash + StPparamsAssetName, quantity: "1" }])
    .txOutInlineDatumValue(ProtocolParametersDatum)
    .txInCollateral(
        wallet1Collateral.input.txHash,
        wallet1Collateral.input.outputIndex,
        wallet1Collateral.output.amount,
        wallet1Collateral.output.address,
    )
    .changeAddress(multiSigAddress)
    .selectUtxosFrom(wallet1Utxos)
    .setFee("1130441")
    .complete()

const signedTx1 = await wallet1.signTx(unsignedTx, true);
const signedTx2 = await wallet2.signTx(signedTx1, true);

const txHash = await wallet1.submitTx(signedTx2);
console.log("Set Protocol Parameters tx hash:", txHash);
