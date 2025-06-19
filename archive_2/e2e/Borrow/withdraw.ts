import { mConStr2 } from "@meshsdk/core"
import { txBuilder, wallet1, wallet1Address, wallet1Collateral, wallet1Utxos, wallet1VK } from "../setup";
import { collateralValidatorScript, userDepositUtxos } from "./setup";

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
    .spendingReferenceTxInRedeemerValue(mConStr2([]))
    .txOut(wallet1Address, userDepositUtxos[0].output.amount)
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

console.log("Withdraw All txHash:", txHash);
