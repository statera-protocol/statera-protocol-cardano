import { IWallet, mConStr0, mConStr1, mConStr3, MeshTxBuilder, UTxO } from "@meshsdk/core";
import { CollateralValidatorAddr, CollateralValidatorScript, identifierTokenUnit } from "../CollateralValidator/validator";
import { getLoanPositionDetails, getUserDepositUtxo } from "../utils";
// import { AssetDetails, BlockchainProviderType, CollateralDatum } from "../types";

export const increaseLoanCollateral = async (
  // blockchainProvider: BlockchainProviderType,
  txBuilder: MeshTxBuilder,
  wallet: IWallet,
  walletAddress: string,
  walletCollateral: UTxO,
  walletUtxos: UTxO[],
  walletVK: string,
  increaseAmountInt: number,
  collateralUtxo: UTxO,
  // collateralAsset: AssetDetails,
) => {
  const userDepositUtxo = await getUserDepositUtxo(walletVK);

  console.log("userDepositUtxo.output.amount[0].quantity:", userDepositUtxo.output.amount[0].quantity);

  const balanceAmountInt = (Number(userDepositUtxo.output.amount[0].quantity) - (Number(increaseAmountInt) * 1000000));
  if (balanceAmountInt < 2000000) throw new Error('Insufficient ADA balance');
  const balanceAmount = String(balanceAmountInt);
  console.log("balanceAmount:", balanceAmount);

  const collateralUtxoDetails = getLoanPositionDetails(collateralUtxo);
  if (!collateralUtxoDetails) {
      throw new Error(`Could not get the loan position details of utxo: ${collateralUtxo}`);
  }
  const {
    st_policy_id,
    st_asset_name,
    st_borrowed,
    loan_nft_pid,
    loan_nft_asset_name,
    collateral_rate_at_lending_precised,
    collateral_asset,
    // collateral_asset_amount,
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
  // console.log("loanNftUtxo:", loanNftUtxo);
  // console.log("userLoanNFTUnit:", userLoanNFTUnit);
  // console.log("collateralUtxo:", collateralUtxo);

  const updatedCollateralAssetAmount =
    String(Number(collateralUtxo.output.amount[0].quantity) + (Number(increaseAmountInt) * 1000000));
  // console.log("updatedCollateralAssetAmount:", updatedCollateralAssetAmount);

  const DepositDatum = mConStr1([
      walletVK,
  ]);

  let collateralAssetStableness = undefined;
  if (collateral_asset.fields[0].constructor == 0) {
    collateralAssetStableness = mConStr0([]);
  } else {
    collateralAssetStableness = mConStr1([]);
  }

  const updatedCollateralDatum = mConStr0([
    st_policy_id,
    st_asset_name,
    Number(st_borrowed),
    loan_nft_pid,
    loan_nft_asset_name,
    Number(collateral_rate_at_lending_precised),
    mConStr0([
      collateralAssetStableness,
      collateral_asset.fields[1].bytes,
      collateral_asset.fields[2].bytes
    ]),
    Number(updatedCollateralAssetAmount),
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
          userDepositUtxo.input.txHash,
          userDepositUtxo.input.outputIndex,
          userDepositUtxo.output.amount,
          userDepositUtxo.output.address,
      )
      // .spendingTxInReference(cVRSTxHash, cVRSTxIndex)
      .txInScript(CollateralValidatorScript)
      .spendingReferenceTxInInlineDatumPresent()
      .spendingReferenceTxInRedeemerValue(mConStr1([]))
      // collateral utxo containing the collateral the user locked
      .spendingPlutusScriptV3()
      .txIn(
          collateralUtxo.input.txHash,
          collateralUtxo.input.outputIndex,
          collateralUtxo.output.amount,
          collateralUtxo.output.address,
      )
      // .spendingTxInReference(cVRSTxHash, cVRSTxIndex)
      .txInScript(CollateralValidatorScript)
      .spendingReferenceTxInInlineDatumPresent()
      .spendingReferenceTxInRedeemerValue(mConStr3([]))
      // updated user balance output
      .txOut(CollateralValidatorAddr, [{ unit: "lovelace", quantity: balanceAmount }, { unit: identifierTokenUnit, quantity: "1" }])
      .txOutInlineDatumValue(DepositDatum)
      // updated collateral output
      .txOut(CollateralValidatorAddr, [{ unit: "lovelace", quantity: updatedCollateralAssetAmount }])
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

  const signedTx = await wallet.signTx(unsignedTx, true);
  const txHash = await wallet.submitTx(signedTx);

  txBuilder.reset();

  return txHash;
}
