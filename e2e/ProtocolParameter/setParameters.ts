import { mConStr0 } from "@meshsdk/common";
import { txBuilder, wallet1Address, wallet1Utxos, wallet1 } from "../setup.js";
import { scriptAddr } from "./validator.js";

const ProtocolParametersDatum = mConStr0([
    15000,
    1000000,
    50000,
    ["ada", "iUSD", "halalend", "hosky"],
    14 * 24 * 60 * 60 * 1000,
]);

const unsignedTx = await txBuilder
    .txOut(scriptAddr, [{ unit: "lovelace", quantity: '2000000' }])
    .txOutInlineDatumValue(ProtocolParametersDatum)
    .changeAddress(wallet1Address)
    .selectUtxosFrom(wallet1Utxos)
    .complete();

const signedTx = await wallet1.signTx(unsignedTx);
const txHash = await wallet1.submitTx(signedTx);

console.log('Set parameters tx hash:', txHash);
