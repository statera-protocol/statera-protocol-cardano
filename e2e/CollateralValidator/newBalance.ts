import { mConStr1, stringToHex } from "@meshsdk/core";
import { txBuilder, wallet1, wallet1Address, wallet1Collateral, wallet1Utxos, wallet1VK } from "../setup.js";
import { CollateralValidatorAddr, CollateralValidatorScript, CollateralValidatorHash, receiptTokenNameHex, identifierTokenNameHex, receiptTokenUnit, identifierTokenUnit } from "./validator.js";

// This field should be dynamic
const depositAmountInt = 300; // In Ada
const depositAmount = String(depositAmountInt * 1000000);

const depositDatum = mConStr1([
    wallet1VK
]);

const unsignedTx = await txBuilder
    .mintPlutusScriptV3()
    .mint("1", CollateralValidatorHash, receiptTokenNameHex)
    .mintingScript(CollateralValidatorScript)
    .mintRedeemerValue("")
    .mintPlutusScriptV3()
    .mint("1", CollateralValidatorHash, identifierTokenNameHex)
    .mintingScript(CollateralValidatorScript)
    .mintRedeemerValue("")
    .txOut(wallet1Address, [{ unit: receiptTokenUnit, quantity: "1" }])
    .txOut(CollateralValidatorAddr, [{ unit: "lovelace", quantity: depositAmount }, { unit: identifierTokenUnit, quantity: "1" }])
    .txOutInlineDatumValue(depositDatum)
    .txInCollateral(
        wallet1Collateral.input.txHash,
        wallet1Collateral.input.outputIndex,
        wallet1Collateral.output.amount,
        wallet1Collateral.output.address,
    )
    .changeAddress(wallet1Address)
    .selectUtxosFrom(wallet1Utxos)
    .complete()

const signedTx = await wallet1.signTx(unsignedTx);
const txHash = await wallet1.submitTx(signedTx);

console.log("New balance txHash:", txHash);
