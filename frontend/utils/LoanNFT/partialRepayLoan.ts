import { IWallet, mConStr, mConStr0, mConStr1, mConStr2, MeshTxBuilder, UTxO } from "@meshsdk/core";
import { CollateralValidatorAddr } from "../CollateralValidator/validator";
import { getLoanPositionDetails } from "../utils";
import { MintStPolicy, MintStValidatorScript } from "../StMinting/validator";
import { setup } from "../setup";

export const partialRepayLoan = async (
  txBuilder: MeshTxBuilder,
  wallet: IWallet,
  walletAddress: string,
  walletCollateral: UTxO,
  walletUtxos: UTxO[],
  repayAmountUsd: number,
  collateralUtxo: UTxO,
) => {
  const { collateralScriptIdx, collateralScriptTxHash, StStableAssetName } = setup();

  const repayAmountSUsd = String(repayAmountUsd * 1000000); // 50 sUSD; 50 million staterites

  // console.log("collateralUtxo:", collateralUtxo.output.amount);
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
    collateral_asset_amount,
  } = collateralUtxoDetails;
  // console.log("collateral_asset_amount:", collateral_asset_amount);
  // console.log("loan_nft_pid:", loan_nft_pid);

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

  const updatedStBorrowed = Number(st_borrowed) - Number(repayAmountSUsd);
  console.log('st_borrowed------:', Number(st_borrowed));
  console.log('repayAmount------:', Number(repayAmountSUsd));
  console.log('updatedStBorrowed:', Number(updatedStBorrowed));

  let collateralAssetStableness = undefined;
  if (collateral_asset.fields[0].constructor == 0) {
    collateralAssetStableness = mConStr0([]);
  } else {
    collateralAssetStableness = mConStr1([]);
  }

  const updatedCollateralDatum = mConStr0([
    st_policy_id,
    st_asset_name,
    updatedStBorrowed,
    loan_nft_pid,
    loan_nft_asset_name,
    Number(collateral_rate_at_lending_precised),
    mConStr0([
      collateralAssetStableness,
      collateral_asset.fields[1].bytes,
      collateral_asset.fields[2].bytes
    ]),
    Number(collateral_asset_amount),
  ]);

  const unsignedTx = await txBuilder
      // collateral utxo containing the collateral the user locked
      .spendingPlutusScriptV3()
      .txIn(
          collateralUtxo.input.txHash,
          collateralUtxo.input.outputIndex,
          collateralUtxo.output.amount,
          collateralUtxo.output.address,
      )
      .spendingTxInReference(collateralScriptTxHash, collateralScriptIdx)
      // .txInScript(CollateralValidatorScript)
      .spendingReferenceTxInInlineDatumPresent()
      .spendingReferenceTxInRedeemerValue(mConStr(5, []))
      // burn partial repay amount
      .mintPlutusScriptV3()
      .mint("-".concat(repayAmountSUsd), MintStPolicy, StStableAssetName)
      // .mintTxInReference(mintStScriptTxHash, mintStScriptTxIdx)
      .mintingScript(MintStValidatorScript)
      .mintRedeemerValue(mConStr2([]))
      // updated collateral output
      .txOut(CollateralValidatorAddr, collateralUtxo.output.amount)
      .txOutInlineDatumValue(updatedCollateralDatum)
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
