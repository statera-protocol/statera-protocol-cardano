import { mConStr0, mConStr1, mConStr3 } from "@meshsdk/core";
import { txBuilder, wallet1, wallet1Address, wallet1Collateral, wallet1Utxos, wallet1VK } from "../setup.js";
import { CollateralValidatorAddr, CollateralValidatorScript, identifierTokenUnit } from "./validator.js";
import { getUserDepositUtxo } from "../utils.js";

const userDepositUtxo = getUserDepositUtxo();

// This field should be dynamic
const depositAmountInt = 100; // In Ada
const totalDepositAmountInt = (depositAmountInt * 1000000) + Number(userDepositUtxo.output.amount[0].quantity)
const depositAmount = String(totalDepositAmountInt);

const depositDatum = mConStr1([
    wallet1VK
]);

const unsignedTx = await txBuilder
    .spendingPlutusScriptV3()
    .txIn(
        userDepositUtxo.input.txHash,
        userDepositUtxo.input.outputIndex,
        userDepositUtxo.output.amount,
        userDepositUtxo.output.address,
    )
    .txInScript(CollateralValidatorScript)
    .spendingReferenceTxInInlineDatumPresent()
    .spendingReferenceTxInRedeemerValue(mConStr0([]))
    .txOut(CollateralValidatorAddr, [{ unit: "lovelace", quantity: depositAmount }, { unit: identifierTokenUnit, quantity: "1" }])
    .txOutInlineDatumValue(depositDatum)
    .txInCollateral(
        wallet1Collateral.input.txHash,
        wallet1Collateral.input.outputIndex,
        wallet1Collateral.output.amount,
        wallet1Collateral.output.address,
    )
    .changeAddress(wallet1Address)
    .requiredSignerHash(wallet1VK)
    .selectUtxosFrom(wallet1Utxos)
    .complete()

const signedTx = await wallet1.signTx(unsignedTx);
const txHash = await wallet1.submitTx(signedTx);

console.log("Increase balance txHash:", txHash);
