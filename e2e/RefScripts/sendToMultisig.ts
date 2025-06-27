import { multiSigAddress, txBuilder, wallet1, wallet1Address, wallet1Utxos } from "../setup.js";


const unsignedTx = await txBuilder
    .txOut(multiSigAddress, [{ unit: "lovelace", quantity: "150000000" }])
    .changeAddress(wallet1Address)
    .selectUtxosFrom(wallet1Utxos)
    .complete()

const signedTx = await wallet1.signTx(unsignedTx);

const txHash = await wallet1.submitTx(signedTx);
console.log("Send ada to multisig:", txHash);
