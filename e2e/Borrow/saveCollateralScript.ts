import { blockchainProvider, txBuilder, wallet1, wallet1Address, wallet1Collateral, wallet1Utxos } from "../setup.js";
import { collateralValidatorScript, oracleAddress } from "./setup.js";

const num = 137.1999995;
const numMod = num % 1
if (numMod) {
    console.log("Number has decimals", numMod);
} else {
    console.log("Number has no decimals", numMod);
}

// const refScriptAddr = oracleAddress;

// const unsignedTx = await txBuilder
//     .txOut(refScriptAddr, [])
//     .txOutReferenceScript(collateralValidatorScript, "V3")
//     .changeAddress(wallet1Address)
//     .selectUtxosFrom(wallet1Utxos)
//     .txInCollateral(
//         wallet1Collateral.input.txHash,
//         wallet1Collateral.input.outputIndex,
//         wallet1Collateral.output.amount,
//         wallet1Collateral.output.address,
//     )
//     .complete()

// const signedTx = await wallet1.signTx(unsignedTx);
// const txHash = await wallet1.submitTx(signedTx);

// console.log('save collateral script tx Hash:', txHash);
