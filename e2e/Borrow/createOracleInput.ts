import { txBuilder, wallet1, wallet1Address, wallet1Utxos } from "../setup.js";
import { mintLoanUnit, oracleAddress } from "./setup.js";

const unsignedTx = await txBuilder
    .txOut(oracleAddress, [{ unit: "lovelace", quantity: "15000000" }, { unit: mintLoanUnit, quantity: "12" }])
    .changeAddress(wallet1Address)
    .selectUtxosFrom(wallet1Utxos)
    .complete()

const signedTx = await wallet1.signTx(unsignedTx);
const txHash = await wallet1.submitTx(signedTx);

console.log('tx Hash:', txHash);
