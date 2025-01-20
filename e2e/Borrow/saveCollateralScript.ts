import { blockchainProvider, txBuilder, wallet1, wallet1Address, wallet1Collateral, wallet1Utxos } from "../setup.js";
import { collateralValidatorScript, oracleAddress } from "./setup.js";

// Get loan NFT asset details
const loanNFTData = await blockchainProvider.get(
    // "assets/" + userLoanNFTUnit
    "assets/" + "9683ecbfb63ccf325b811b8539b31effc56a7d0fe3a55784147661a9737461746572612d6272772d6236642331"
);
const loanNFTTxHash = loanNFTData.data.first_mint_tx.tx_hash;

console.log("loanNFTData:", loanNFTData);
console.log("loanNFTTxHash:", loanNFTTxHash);

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
