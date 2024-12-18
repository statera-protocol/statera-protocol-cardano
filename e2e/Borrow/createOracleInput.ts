import { txBuilder, wallet1, wallet1Address, wallet1Utxos } from "../setup.js";
import { oracleAddress } from "./setup.js";

const unsignedTx = await txBuilder
    .txOut(oracleAddress, [{ unit: "lovelace", quantity: "15000000" }, { unit: "b2af4d6208ee4114c74dc01b7111ba1df61a94a2d7d2fd7c473b139f74555344", quantity: "12" }])
    .changeAddress(wallet1Address)
    .selectUtxosFrom(wallet1Utxos)
    .complete()

const signedTx = await wallet1.signTx(unsignedTx);
const txHash = await wallet1.submitTx(signedTx);

console.log('tx Hash:', txHash);
