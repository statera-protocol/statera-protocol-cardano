import { IWallet, mConStr1, MeshTxBuilder, UTxO } from "@meshsdk/core";
import { CollateralValidatorAddr, CollateralValidatorScript, identifierTokenUnit } from "./validator";
import { getUserDepositUtxo } from "../utils";

export const reduceBalance = async (
    txBuilder: MeshTxBuilder,
    wallet: IWallet,
    walletAddress: string,
    walletCollateral: UTxO,
    walletUtxos: UTxO[],
    walletVK: string,
    withdrawAmountInt: number,
) => {
    const userDepositUtxo = await getUserDepositUtxo(walletVK);

    const balanceAmountInt = (Number(userDepositUtxo.output.amount[0].quantity) - (withdrawAmountInt * 1000000));
    const withdrawAmount = String(withdrawAmountInt * 1000000);
    const balanceAmount = String(balanceAmountInt);

    const depositDatum = mConStr1([
        walletVK
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
        .txOut(walletAddress, [{ unit: "lovelace", quantity: withdrawAmount }])
        .txOut(CollateralValidatorAddr, [{ unit: "lovelace", quantity: balanceAmount },  { unit: identifierTokenUnit, quantity: "1" }])
        .txOutInlineDatumValue(depositDatum)
        .txInCollateral(
            walletCollateral.input.txHash,
            walletCollateral.input.outputIndex,
            walletCollateral.output.amount,
            walletCollateral.output.address,
        )
        .changeAddress(walletAddress)
        .requiredSignerHash(walletVK)
        .selectUtxosFrom(walletUtxos)
        .complete()

    const signedTx = await wallet.signTx(unsignedTx, true);
    const txHash = await wallet.submitTx(signedTx);

    txBuilder.reset();

    return txHash;
}
