import { IWallet, mConStr2, MeshTxBuilder, UTxO } from "@meshsdk/core"

export const withdraw = async (
    wallet: IWallet,
    txBuilder: MeshTxBuilder,
    collateralValidatorScript: string,
    userDepositUtxos: UTxO[],
    walletAddress: string,
    walletCollateral: UTxO,
    walletUtxos: UTxO[],
    walletVK: string,
) => {
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
        .txOut(walletAddress, userDepositUtxos[0].output.amount)
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

    console.log("Withdraw All txHash:", txHash);
}
