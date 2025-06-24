import { mConStr0, mPubKeyAddress } from "@meshsdk/core";
import { txBuilder, usdmUnit, wallet1, wallet1Address, wallet1SK, wallet1Utxos, wallet1VK } from "../setup.js";
import { OrderValidatorAddr } from "./validators.js";

const mAddr1 = mPubKeyAddress(wallet1VK, wallet1SK);
const mAddr2 = mPubKeyAddress(wallet1VK, wallet1SK);

const OrderDatum = mConStr0([
    mConStr0([]),
    mAddr1,
    wallet1VK,
]);

const unsignedTx = await txBuilder
    .txOut(OrderValidatorAddr, [{ unit: usdmUnit, quantity: "10000000" }])
    .txOutInlineDatumValue(OrderDatum)
    .changeAddress(wallet1Address)
    .selectUtxosFrom(wallet1Utxos)
    .complete()

const signedTx = await wallet1.signTx(unsignedTx);

const txHash = await wallet1.submitTx(signedTx);
console.log("Create order:", txHash);
