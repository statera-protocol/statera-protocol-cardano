import { mConStr, mConStr1, mConStr3, stringToHex } from "@meshsdk/core";
import { txBuilder, wallet1, wallet1Address, wallet1Collateral, wallet1Utxos, wallet1VK } from "../setup.js";
import { collateralValidatorAddress, collateralValidatorScript, collateralValidatorScriptHash, userDepositUtxos } from "./setup.js";

// This field should be dynamic
const withdrawAmountInt = 50; // In Ada
const balanceAmountInt = (Number(userDepositUtxos[0].output.amount[0].quantity) - (withdrawAmountInt * 1000000));
const withdrawAmount = String(withdrawAmountInt * 1000000);
const balanceAmount = String(balanceAmountInt);

const depositDatum = mConStr1([
    wallet1VK
]);

const unsignedTx = await txBuilder
    .spendingPlutusScriptV3()
    .txIn(
        userDepositUtxos[0].input.txHash,
        userDepositUtxos[0].input.outputIndex,
        userDepositUtxos[0].output.amount,
        userDepositUtxos[0].output.address,
    )
    .txInScript(collateralValidatorScript)
    .spendingReferenceTxInInlineDatumPresent()
    .spendingReferenceTxInRedeemerValue(mConStr(4, []))
    .txOut(wallet1Address, [{ unit: "lovelace", quantity: withdrawAmount }])
    .txOut(collateralValidatorAddress, [{ unit: "lovelace", quantity: balanceAmount }])
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

console.log("Partial withdraw txHash:", txHash);
