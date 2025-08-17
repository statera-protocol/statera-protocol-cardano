import { IWallet, mConStr, mConStr0, mConStr1, mConStr2, mConStr3, MeshTxBuilder, stringToHex, UTxO } from "@meshsdk/core";
import { getLoanPositionDetails } from "./getLoanPositions";
import { cVRSTxHash, cVRSTxIndex, mintLoanScriptTxHash, mintLoanScriptTxIndex } from "./setup";

export const partialRepay = async (
    txBuilder: MeshTxBuilder,
    wallet: IWallet,
    walletAddress: string,
    walletCollateral: UTxO,
    walletUtxos: UTxO[],
    collateralValidatorAddress: string,
    collateralUtxo: UTxO,
    mintLoanPolicyId: string,
    mintLoanAssetNameHex: string,
    repayAmount: string | undefined,
) => {
    if (!repayAmount) {
        throw new Error('Repay amount not provided');
    }

    const collateralUtxoDetails = getLoanPositionDetails(collateralUtxo);
    if (!collateralUtxoDetails) {
        throw new Error(`Could not get the loan position details of utxo: ${collateralUtxo}`);
    }
    const {
        tusd_pool_hash,
        tusd_policy_id,
        tusd_asset_name,
        tusd_borrowed,
        loan_nft_pid,
        loan_nft_asset_name,
        collateral_rate_in_lovelace,
        collateral_asset,
        collateral_amount_in_lovelace,
    } = collateralUtxoDetails;

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

    const updatedTusdBorrowed = Number(tusd_borrowed) - Number(repayAmount)
    console.log('tusd_borrowed:', Number(tusd_borrowed));
    console.log('repayAmount:', Number(repayAmount));
    console.log('updatedTusdBorrowed:', Number(updatedTusdBorrowed));

    const updatedCollateralDatum = mConStr0([
        tusd_pool_hash,
        tusd_policy_id,
        tusd_asset_name,
        updatedTusdBorrowed,
        loan_nft_pid,
        loan_nft_asset_name,
        collateral_rate_in_lovelace,
        collateral_asset,
        collateral_amount_in_lovelace,
    ]);

    const unsignedTx = await txBuilder
        // loan NFT input from user's wallet
        .txIn(
            loanNftUtxo.input.txHash,
            loanNftUtxo.input.outputIndex,
            loanNftUtxo.output.amount,
            loanNftUtxo.output.address,
        )
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
        .spendingReferenceTxInRedeemerValue(mConStr(6, []))
        // burn partial repay amount
        .mintPlutusScriptV3()
        .mint("-".concat(String(repayAmount)), mintLoanPolicyId, mintLoanAssetNameHex)
        .mintTxInReference(mintLoanScriptTxHash, mintLoanScriptTxIndex)
        .mintRedeemerValue(mConStr2([]))
        // updated collateral output
        .txOut(collateralValidatorAddress, collateralUtxo.output.amount)
        .txOutInlineDatumValue(updatedCollateralDatum)
        // user wallet output
        .txOut(walletAddress, [ { unit: (loan_nft_pid + loan_nft_asset_name), quantity: "1" } ])
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

    console.log("Partial repayment txHash:", txHash);
}
