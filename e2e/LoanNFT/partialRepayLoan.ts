import { deserializeDatum, mConStr, mConStr0, mConStr1, mConStr2 } from "@meshsdk/core";
import { CollateralDatum } from "../types.js";
import { blockchainProvider, StStableAssetName, txBuilder, wallet1, wallet1Address, wallet1Collateral, wallet1Utxos, wallet1VK } from "../setup.js";
import { CollateralValidatorAddr, CollateralValidatorScript } from "../CollateralValidator/validator.js";
import { getLoanPositionDetails } from "../utils.js";
import { MintStPolicy, MintStValidatorScript } from "../StMinting/validator.js";

const repayAmountSUsd = String(50 * 1000000); // 50 sUSD; 50 million staterites

const allCollateralValidatorUtxos = await blockchainProvider.fetchAddressUTxOs(CollateralValidatorAddr);
const collateralUtxos = allCollateralValidatorUtxos.filter(utxo => {
  const plutusData = utxo.output.plutusData;
  if (!plutusData) return false;
  const datum = deserializeDatum<CollateralDatum>(plutusData);
  return !!datum.fields[7];
});
// console.log("sajskasa:", collateralUtxos, '\n', collateralUtxos.length);

const collateralUtxo = collateralUtxos[0];
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
const loanNftUtxo = wallet1Utxos.find(walletUtxo => {
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
// console.log('st_borrowed:', Number(st_borrowed));
// console.log('repayAmount:', Number(repayAmountSUsd));
// console.log('updatedTusdBorrowed:', Number(updatedStBorrowed));

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
    // .spendingTxInReference(cVRSTxHash, cVRSTxIndex)
    .txInScript(CollateralValidatorScript)
    .spendingReferenceTxInInlineDatumPresent()
    .spendingReferenceTxInRedeemerValue(mConStr(6, []))
    // burn partial repay amount
    .mintPlutusScriptV3()
    .mint("-".concat(repayAmountSUsd), MintStPolicy, StStableAssetName)
    // .mintTxInReference(mintLoanScriptTxHash, mintLoanScriptTxIndex)
    .mintingScript(MintStValidatorScript)
    .mintRedeemerValue(mConStr2([]))
    // updated collateral output
    .txOut(CollateralValidatorAddr, collateralUtxo.output.amount)
    .txOutInlineDatumValue(updatedCollateralDatum)
    // user wallet output
    .txOut(wallet1Address, [ { unit: (loan_nft_pid + loan_nft_asset_name), quantity: "1" } ])
    // .txOut(wallet1Address, loanNftUtxo.output.amount)
    .txInCollateral(
        wallet1Collateral.input.txHash,
        wallet1Collateral.input.outputIndex,
        wallet1Collateral.output.amount,
        wallet1Collateral.output.address,
    )
    .changeAddress(wallet1Address)
    .selectUtxosFrom(wallet1Utxos)
    .complete()

const signedTx = await wallet1.signTx(unsignedTx);
const txHash = await wallet1.submitTx(signedTx);

console.log("Partial repay loan txHash:", txHash);
