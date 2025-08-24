import { IWallet, mConStr1, MeshTxBuilder, UTxO } from "@meshsdk/core";
import { CollateralValidatorAddr, CollateralValidatorScript, CollateralValidatorHash, receiptTokenNameHex, identifierTokenNameHex, receiptTokenUnit, identifierTokenUnit } from "./validator";

export const newBalance = async (
    txBuilder: MeshTxBuilder,
    wallet: IWallet,
    walletAddress: string,
    walletCollateral: UTxO,
    walletUtxos: UTxO[],
    walletVK: string,
    depositAmountInt: number,
) => {
    const depositAmount = String(depositAmountInt * 1000000);

    const depositDatum = mConStr1([
        walletVK
    ]);

    const unsignedTx = await txBuilder
        .mintPlutusScriptV3()
        .mint("1", CollateralValidatorHash, receiptTokenNameHex)
        .mintingScript(CollateralValidatorScript)
        .mintRedeemerValue("")
        .mintPlutusScriptV3()
        .mint("1", CollateralValidatorHash, identifierTokenNameHex)
        .mintingScript(CollateralValidatorScript)
        .mintRedeemerValue("")
        .txOut(walletAddress, [{ unit: receiptTokenUnit, quantity: "1" }])
        .txOut(CollateralValidatorAddr, [{ unit: "lovelace", quantity: depositAmount }, { unit: identifierTokenUnit, quantity: "1" }])
        .txOutInlineDatumValue(depositDatum)
        .txInCollateral(
            walletCollateral.input.txHash,
            walletCollateral.input.outputIndex,
            walletCollateral.output.amount,
            walletCollateral.output.address,
        )
        .changeAddress(walletAddress)
        .selectUtxosFrom(walletUtxos)
        .complete()

    const signedTx = await wallet.signTx(unsignedTx, true);
    const txHash = await wallet.submitTx(signedTx);

    txBuilder.reset();

    return txHash;
}
