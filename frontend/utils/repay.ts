import { applyParamsToScript, builtinByteString, IWallet, MaestroProvider, mConStr0, mConStr1, MeshTxBuilder, outputReference, UTxO } from "@meshsdk/core";
import { getLoanPositionDetails } from "./getLoanPositions";

export const repayLoan = async (
    blockchainProvider: MaestroProvider,
    txBuilder: MeshTxBuilder,
    wallet: IWallet,
    walletAddress: string,
    walletCollateral: UTxO,
    walletUtxos: UTxO[],
    collateralValidatorScript: string,
    collateralValidatorAddress: string,
    loanNftValidatorCode: any,
    oracleUtxo: UTxO | undefined,
    mintLoanAssetNameHex: string,
    mintLoanPolicyId: string,
    mintLoanValidatorScript: string,
    collateralValidatorScriptHash: string,
    protocolParametersScriptHash: string,
    oracleScriptHash: string,
    collateralUtxo: UTxO,
) => {
    if (!oracleUtxo) {
        throw new Error('Oracle UTxO not found!');
    }

    const collateralUtxoDetails = getLoanPositionDetails(collateralUtxo)
    if (!collateralUtxoDetails) {
        throw new Error(`Could not get the loan position details of utxo: ${collateralUtxo}`);
    }
    const { tusd_borrowed, loan_nft_pid } = collateralUtxoDetails;

    let userLoanNFTUnit = "";
    // Find the loan NFT UTxO corresponding to the provided collateral UTxO
    const loanNftUtxo = walletUtxos.find(walletUtxo => {
        const walletUtxoAmountUnits = walletUtxo.output.amount.map((amount) => amount.unit);

        for (let i = 0; i < walletUtxoAmountUnits.length; i++) {
            if (walletUtxoAmountUnits[i].slice(0, 56) == loan_nft_pid) {
                userLoanNFTUnit = walletUtxoAmountUnits[i];
                return true;
            }
        }
    })

    if (userLoanNFTUnit == "") {
        throw new Error("Loan NFT UTxO with same loan_nft_pid not found");
    }
    if (!loanNftUtxo) {
        throw new Error("Loan NFT UTxO not found");
    }
    console.log("loanNftUtxo:", loanNftUtxo);
    console.log("userLoanNFTUnit:", userLoanNFTUnit);
    console.log("collateralUtxo:", collateralUtxo);

    // Get the collateral utxo transaction data
    const txData = await blockchainProvider.get(
        "transactions/" + collateralUtxo.input.txHash,
    );
    // Get the utxo to use to reconstruct the loanNftValidatorScript
    const LnvsUtxo = (txData.data.inputs.filter((input: any) => (
        input.address == collateralValidatorAddress
    )))[0]
    if (!LnvsUtxo) {
        throw new Error("LnvsUtxo not found");
    }
    console.log("txData:", txData);
    console.log("txData Input:", LnvsUtxo);
    // Reconstruct the loanNftValidatorScript
    const paramUtxo = outputReference(LnvsUtxo.tx_hash, LnvsUtxo.index);
    const recLoanNftValidatorScript = applyParamsToScript(
      loanNftValidatorCode[0].compiledCode,
      [
          paramUtxo,
          builtinByteString(collateralValidatorScriptHash),
          builtinByteString(protocolParametersScriptHash),
          builtinByteString(oracleScriptHash),
      ],
      "JSON"
    );

    // Collateral validator reference script info
    const cVRSTxHash = "e0e4066d4356a6f7f5372985bc591f219c4839064f499daca2d771bdfe47383f";
    const cVRSTxIndex = 0;

    const unsignedTx = await txBuilder
        .txIn(
            loanNftUtxo.input.txHash,
            loanNftUtxo.input.outputIndex,
            loanNftUtxo.output.amount,
            loanNftUtxo.output.address,
        )
        .spendingPlutusScriptV3()
        .txIn(
            collateralUtxo.input.txHash,
            collateralUtxo.input.outputIndex,
            collateralUtxo.output.amount,
            collateralUtxo.output.address,
        )
        .spendingTxInReference(cVRSTxHash, cVRSTxIndex)
        .spendingReferenceTxInInlineDatumPresent()
        .spendingReferenceTxInRedeemerValue(mConStr0([]))
        .mintPlutusScriptV3()
        .mint("-1", userLoanNFTUnit.slice(0, 56), userLoanNFTUnit.slice(56))
        .mintingScript(recLoanNftValidatorScript)
        .mintRedeemerValue(mConStr1([]))
        .mintPlutusScriptV3()
        .mint("-".concat(String(tusd_borrowed)), mintLoanPolicyId, mintLoanAssetNameHex)
        .mintingScript(mintLoanValidatorScript)
        .mintRedeemerValue(mConStr1([]))
        .txOut(walletAddress, collateralUtxo.output.amount)
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
    
    console.log('Repayment tx hash:', txHash);
}
