import { mConStr1, stringToHex } from "@meshsdk/core";
import { txBuilder, wallet1, wallet1Address, wallet1Collateral, wallet1Utxos, wallet1VK } from "../setup.js";
import { collateralValidatorAddress, collateralValidatorScript, collateralValidatorScriptHash } from "./setup.js";

const receiptTokenName = "statera-receipt";
const receiptTokenNameHex = stringToHex(receiptTokenName);
const receiptTokenUnit = collateralValidatorScriptHash +  receiptTokenNameHex;

const identifierTokenName = "st-identifier";
const identifierTokenNameHex = stringToHex(identifierTokenName);
const identifierTokenUnit = collateralValidatorScriptHash +  identifierTokenNameHex;

// This field should be dynamic
const depositAmountInt = 200; // In Ada
const depositAmount = String(depositAmountInt * 1000000);

const depositDatum = mConStr1([
    wallet1VK
]);

const unsignedTx = await txBuilder
    .mintPlutusScriptV3()
    .mint("1", collateralValidatorScriptHash, receiptTokenNameHex)
    .mintingScript(collateralValidatorScript)
    .mintRedeemerValue("")
    .mintPlutusScriptV3()
    .mint("1", collateralValidatorScriptHash, identifierTokenNameHex)
    .mintingScript(collateralValidatorScript)
    .mintRedeemerValue("")
    .txOut(wallet1Address, [{ unit: receiptTokenUnit, quantity: "1" }])
    .txOut(collateralValidatorAddress, [{ unit: "lovelace", quantity: depositAmount }, { unit: identifierTokenUnit, quantity: "1" }])
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

console.log("Deposit txHash:", txHash);
