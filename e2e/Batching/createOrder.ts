import { mConStr0, mConStr1, mPubKeyAddress } from "@meshsdk/core";
import { StStableAssetName, txBuilder, wallet1, wallet1Address, wallet1SK, wallet1Utxos, wallet1VK, wallet2SK, wallet2VK } from "../setup.js";
import { batchingAsset, OrderValidatorAddr } from "./validators.js";

const mAddr1 = mPubKeyAddress(wallet1VK, wallet1SK);
const mAddr2 = mPubKeyAddress(wallet2VK, wallet2SK);

const OrderDatum = mConStr0([
    mConStr0([]), // Buy
    // mConStr1([]), // Sell
    mAddr1,
    wallet1VK,
    mConStr0([
        mConStr1([]),
        batchingAsset.policy,
        batchingAsset.name,
    ]),
]);

const unsignedTx = await txBuilder
    .txOut(OrderValidatorAddr, [{ unit: batchingAsset.unit, quantity: "15000000" }]) // Buy
    // .txOut(OrderValidatorAddr, [{ unit: stUnit, quantity: "7000000" }]) // Sell
    .txOutInlineDatumValue(OrderDatum)
    .changeAddress(wallet1Address)
    .selectUtxosFrom(wallet1Utxos)
    .complete()

const signedTx = await wallet1.signTx(unsignedTx);

const txHash = await wallet1.submitTx(signedTx);
console.log("Create order:", txHash);
