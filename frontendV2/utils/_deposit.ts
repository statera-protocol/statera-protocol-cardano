import { IWallet, mConStr1, MeshTxBuilder, stringToHex, UTxO } from "@meshsdk/core";

export const deposit = async (
    txBuilder: MeshTxBuilder,
    wallet: IWallet,
    walletAddress: string,
    walletCollateral: UTxO,
    walletUtxos: UTxO[],
    walletVK: string,
    collateralValidatorAddress: string,
    collateralValidatorScript: string,
    collateralValidatorScriptHash: string,
    depositAmountInt: string | undefined,
    identifierTokenNameHex: string,
    identifierTokenUnit: string,
) => {
    const receiptTokenName = "statera-receipt";
    const receiptTokenNameHex = stringToHex(receiptTokenName);
    const receiptTokenUnit = collateralValidatorScriptHash + receiptTokenNameHex;

    if (!depositAmountInt) {
        throw new Error("Deposit amount int is undefined");
    }
    const depositAmount = String(Number(depositAmountInt) * 1000000);

    const depositDatum = mConStr1([
        walletVK
    ]);

    const unsignedTx = await txBuilder
        .mintPlutusScriptV3()
        .mint("1", collateralValidatorScriptHash, receiptTokenNameHex)
        .mintingScript(collateralValidatorScript)
        .mintRedeemerValue("")
        .mintPlutusScriptV3()
        .mint("1", collateralValidatorScriptHash, identifierTokenNameHex)
        .mintingScript(collateralValidatorScript)
        .mintRedeemerValue("")
        .txOut(walletAddress, [{ unit: receiptTokenUnit, quantity: "1" }])
        .txOut(collateralValidatorAddress, [{ unit: "lovelace", quantity: depositAmount }, { unit: identifierTokenUnit, quantity: "1" }])
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

    const signedTx = await wallet.signTx(unsignedTx);
    const txHash = await wallet.submitTx(signedTx);

    console.log("Deposit txHash (New Deposit/Create Account):", txHash);
}
