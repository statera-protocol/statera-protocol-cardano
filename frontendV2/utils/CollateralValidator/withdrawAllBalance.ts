import { IWallet, mConStr2, MeshTxBuilder, UTxO } from "@meshsdk/core"
import { CollateralValidatorScript } from "./validator";
import { getUserDepositUtxo } from "../utils";

export const withdrawAllBalance = async (
    txBuilder: MeshTxBuilder,
    wallet: IWallet,
    walletAddress: string,
    walletCollateral: UTxO,
    walletUtxos: UTxO[],
    walletVK: string,
) => {
    const userDepositUtxo = await getUserDepositUtxo(walletVK);

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
        .spendingReferenceTxInRedeemerValue(mConStr2([]))
        .txOut(walletAddress, userDepositUtxo.output.amount)
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
