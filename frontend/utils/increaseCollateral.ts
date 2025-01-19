import { IWallet, mConStr, mConStr0, mConStr1, mConStr3, MeshTxBuilder, stringToHex, UTxO } from "@meshsdk/core";
import { getLoanPositionDetails } from "./getLoanPositions";
import { cVRSTxHash, cVRSTxIndex } from "./setup";

export const increaseCollateral = async (
    txBuilder: MeshTxBuilder,
    wallet: IWallet,
    walletAddress: string,
    walletCollateral: UTxO,
    walletUtxos: UTxO[],
    walletVK: string,
    collateralValidatorAddress: string,
    collateralValidatorScript: string,
    userDepositUtxos: UTxO[],
    collateralUtxo: UTxO,
    increaseAmountInt: string | undefined,
    identifierTokenUnit: string,
) => {
    const balanceAmountInt = (Number(userDepositUtxos[0].output.amount[0].quantity) - (Number(increaseAmountInt) * 1000000));
    // const withdrawAmount = String(Number(increaseAmountInt) * 1000000);
    const balanceAmount = String(balanceAmountInt);

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

    const updatedCollateralAmount = String(Number(collateralUtxo.output.amount[0].quantity) + (Number(increaseAmountInt) * 1000000));

    const userBalanceDatum = mConStr1([
        walletVK
    ]);

    const updatedCollateralDatum = mConStr0([
        tusd_pool_hash,
        tusd_policy_id,
        tusd_asset_name,
        tusd_borrowed,
        loan_nft_pid,
        loan_nft_asset_name,
        collateral_rate_in_lovelace,
        collateral_asset,
        Number(updatedCollateralAmount),
    ]);

    const unsignedTx = await txBuilder
        // loan NFT input from user's wallet
        .txIn(
            loanNftUtxo.input.txHash,
            loanNftUtxo.input.outputIndex,
            loanNftUtxo.output.amount,
            loanNftUtxo.output.address,
        )
        // user balance input
        .spendingPlutusScriptV3()
        .txIn(
            userDepositUtxos[0].input.txHash,
            userDepositUtxos[0].input.outputIndex,
            userDepositUtxos[0].output.amount,
            userDepositUtxos[0].output.address,
        )
        .spendingTxInReference(cVRSTxHash, cVRSTxIndex)
        .spendingReferenceTxInInlineDatumPresent()
        .spendingReferenceTxInRedeemerValue(mConStr(4, []))
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
        .spendingReferenceTxInRedeemerValue(mConStr(5, []))
        // updated user balance output
        .txOut(collateralValidatorAddress, [{ unit: "lovelace", quantity: balanceAmount }, { unit: identifierTokenUnit, quantity: "1" }])
        .txOutInlineDatumValue(userBalanceDatum)
        // updated collateral output
        .txOut(collateralValidatorAddress, [{ unit: "lovelace", quantity: updatedCollateralAmount }])
        .txOutInlineDatumValue(updatedCollateralDatum)
        // user wallet output
        .txOut(walletAddress, loanNftUtxo.output.amount)
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
