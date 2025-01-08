import { IWallet, mConStr, mConStr1, mConStr3, MeshTxBuilder, stringToHex, UTxO } from "@meshsdk/core";

export const partialWithdraw = async (
    txBuilder: MeshTxBuilder,
    wallet: IWallet,
    walletAddress: string,
    walletCollateral: UTxO,
    walletUtxos: UTxO[],
    walletVK: string,
    collateralValidatorAddress: string,
    collateralValidatorScript: string,
    userDepositUtxos: UTxO[],
    withdrawAmountInt: string | undefined,
    identifierTokenUnit: string,
) => {
    const balanceAmountInt = (Number(userDepositUtxos[0].output.amount[0].quantity) - (Number(withdrawAmountInt) * 1000000));
    const withdrawAmount = String(Number(withdrawAmountInt) * 1000000);
    const balanceAmount = String(balanceAmountInt);

    const depositDatum = mConStr1([
        walletVK
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
        .txOut(walletAddress, [{ unit: "lovelace", quantity: withdrawAmount }])
        .txOut(collateralValidatorAddress, [{ unit: "lovelace", quantity: balanceAmount }, { unit: identifierTokenUnit, quantity: "1" }])
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

    const signedTx = await wallet.signTx(unsignedTx);
    const txHash = await wallet.submitTx(signedTx);

    console.log("Partial withdraw txHash:", txHash);

}
