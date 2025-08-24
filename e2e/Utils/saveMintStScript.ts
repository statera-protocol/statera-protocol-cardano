import { applyCborEncoding, serializePlutusScript } from "@meshsdk/core";
import { txBuilder, wallet1, wallet1Address, wallet1Utxos } from "../setup.js";
import { MintStValidatorScript } from "../StMinting/validator.js";

const refScript = applyCborEncoding("5857010100323232323225333002323232323253330073370e900118041baa00113233224a060160026016601800260126ea800458c024c02800cc020008c01c008c01c004c010dd50008a4c26cacae6955ceaab9e5742ae89");
const refAddress = serializePlutusScript(
    { code: refScript, version: "V3" }
).address;

const unsignedTx = await txBuilder
    .txOut(refAddress, [])
    .txOutReferenceScript(MintStValidatorScript, "V3")
    .changeAddress(wallet1Address)
    .selectUtxosFrom(wallet1Utxos)
    .complete()

const signedTx = await wallet1.signTx(unsignedTx);

const txHash = await wallet1.submitTx(signedTx);
console.log("Save mint st script:", txHash);
