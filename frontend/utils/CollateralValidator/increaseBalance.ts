import { IWallet, mConStr0, mConStr1, MeshTxBuilder, UTxO } from "@meshsdk/core";
import { CollateralValidatorAddr, CollateralValidatorScript, identifierTokenUnit } from "./validator";
import { getUserDepositUtxo } from "../utils";

export const increaseBalance = async (
    txBuilder: MeshTxBuilder,
    wallet: IWallet,
    walletAddress: string,
    walletCollateral: UTxO,
    walletUtxos: UTxO[],
    walletVK: string,
    depositAmountInt: number,
) => {
    const userDepositUtxo = await getUserDepositUtxo(walletVK);

    const totalDepositAmountInt = (depositAmountInt * 1000000) + Number(userDepositUtxo.output.amount[0].quantity)
    const depositAmount = String(totalDepositAmountInt);

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
        .spendingReferenceTxInRedeemerValue(mConStr0([]))
        .txOut(CollateralValidatorAddr, [{ unit: "lovelace", quantity: depositAmount }, { unit: identifierTokenUnit, quantity: "1" }])
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
