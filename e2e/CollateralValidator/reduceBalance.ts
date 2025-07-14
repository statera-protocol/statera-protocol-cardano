import { mConStr1 } from "@meshsdk/core";
import { txBuilder, wallet1, wallet1Address, wallet1Collateral, wallet1Utxos, wallet1VK } from "../setup.js";
import { CollateralValidatorAddr, CollateralValidatorScript, identifierTokenUnit } from "./validator.js";
import { getUserDepositUtxo } from "../utils.js";

const userDepositUtxo = getUserDepositUtxo();

// This field should be dynamic
const withdrawAmountInt = 50; // In Ada
const balanceAmountInt = (Number(userDepositUtxo.output.amount[0].quantity) - (withdrawAmountInt * 1000000));
const withdrawAmount = String(withdrawAmountInt * 1000000);
const balanceAmount = String(balanceAmountInt);

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
    .spendingReferenceTxInRedeemerValue(mConStr1([]))
    .txOut(wallet1Address, [{ unit: "lovelace", quantity: withdrawAmount }])
    .txOut(CollateralValidatorAddr, [{ unit: "lovelace", quantity: balanceAmount },  { unit: identifierTokenUnit, quantity: "1" }])
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

console.log("reduce balance txHash:", txHash);
