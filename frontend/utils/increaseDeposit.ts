import { IWallet, mConStr1, mConStr3, MeshTxBuilder, stringToHex, UTxO } from "@meshsdk/core";

export const increaseDeposit = async (
    txBuilder: MeshTxBuilder,
    wallet: IWallet,
    walletAddress: string,
    walletCollateral: UTxO,
    walletUtxos: UTxO[],
    walletVK: string,
    collateralValidatorAddress: string,
    collateralValidatorScript: string,
    userDepositUtxos: UTxO[],
    depositAmountInt: string | undefined,
    identifierTokenUnit: string,
) => {
    if (!depositAmountInt) {
        throw new Error("Deposit amount int is undefined");
    }
    const totalDepositAmountInt = (Number(depositAmountInt) * 1000000) + Number(userDepositUtxos[0].output.amount[0].quantity)
    const depositAmount = String(totalDepositAmountInt);

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
        .spendingReferenceTxInRedeemerValue(mConStr3([]))
        .txOut(collateralValidatorAddress, [{ unit: "lovelace", quantity: depositAmount }, { unit: identifierTokenUnit, quantity: "1" }])
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

    console.log("Deposit txHash (Increase Deposit):", txHash);
}
