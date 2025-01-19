import { applyParamsToScript, builtinByteString, IWallet, MaestroProvider, mConStr0, mConStr1, mConStr3, MeshTxBuilder, outputReference, UTxO } from "@meshsdk/core";
import { getLoanPositionDetails } from "./getLoanPositions";
import { cVRSTxHash, cVRSTxIndex, mintLoanScriptTxHash, mintLoanScriptTxIndex } from "./setup";

export const repayLoan = async (
    blockchainProvider: MaestroProvider,
    txBuilder: MeshTxBuilder,
    wallet: IWallet,
    walletAddress: string,
    walletCollateral: UTxO,
    walletUtxos: UTxO[],
    walletVK: string,
    collateralValidatorAddress: string,
    loanNftValidatorCode: any,
    oracleUtxo: UTxO | undefined,
    mintLoanAssetNameHex: string,
    mintLoanPolicyId: string,
    collateralValidatorScriptHash: string,
    protocolParametersScriptHash: string,
    oracleScriptHash: string,
    collateralUtxo: UTxO,
    userDepositUtxos: UTxO[],
    identifierTokenUnit: string,
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

    const userBalanceDatum = mConStr1([
        walletVK
    ]);
    // Add lovelace quantity of user balance to the collateral amount (first asset is always ADA)
    const userBalanceUpdated = Number(userDepositUtxos[0].output.amount[0].quantity) + Number(collateralUtxo.output.amount[0].quantity);

    const unsignedTx = await txBuilder
        // loan NFT input from user's wallet
        .txIn(
            loanNftUtxo.input.txHash,
            loanNftUtxo.input.outputIndex,
            loanNftUtxo.output.amount,
            loanNftUtxo.output.address,
        )
        // user's balance utxo in the protocol
        .spendingPlutusScriptV3()
        .txIn(
            userDepositUtxos[0].input.txHash,
            userDepositUtxos[0].input.outputIndex,
            userDepositUtxos[0].output.amount,
            userDepositUtxos[0].output.address,
        )
        .spendingTxInReference(cVRSTxHash, cVRSTxIndex)
        .spendingReferenceTxInInlineDatumPresent()
        .spendingReferenceTxInRedeemerValue(mConStr3([]))
        // collateral utxo containing the collateral the user locked
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
        // burns the loan NFT
        .mintPlutusScriptV3()
        .mint("-1", userLoanNFTUnit.slice(0, 56), userLoanNFTUnit.slice(56))
        .mintingScript(recLoanNftValidatorScript)
        .mintRedeemerValue(mConStr1([]))
        // burns the loan tokens (stable coin)
        .mintPlutusScriptV3()
        .mint("-".concat(String(tusd_borrowed)), mintLoanPolicyId, mintLoanAssetNameHex)
        .mintTxInReference(mintLoanScriptTxHash, mintLoanScriptTxIndex)
        .mintRedeemerValue(mConStr1([]))
        // send updated user balance (with the unlocked collateral amount)
        .txOut(collateralValidatorAddress, [{ unit: "lovelace", quantity: String(userBalanceUpdated) }, { unit: identifierTokenUnit, quantity: "1" }])
        .txOutInlineDatumValue(userBalanceDatum)
        .txInCollateral(
            walletCollateral.input.txHash,
            walletCollateral.input.outputIndex,
            walletCollateral.output.amount,
            walletCollateral.output.address,
        )
        .requiredSignerHash(walletVK)
        .changeAddress(walletAddress)
        .selectUtxosFrom(walletUtxos)
        .complete()

    const signedTx = await wallet.signTx(unsignedTx);
    const txHash = await wallet.submitTx(signedTx);

    console.log('Repayment tx hash:', txHash);
}
