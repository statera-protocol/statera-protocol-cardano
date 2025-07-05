import { applyParamsToScript, builtinByteString, deserializeDatum, mConStr, mConStr0, mConStr1, mConStr3, outputReference } from "@meshsdk/core";
import { CollateralValidatorAddr, CollateralValidatorHash, CollateralValidatorScript, identifierTokenUnit } from "../CollateralValidator/validator.js";
import { blockchainProvider, StStableAssetName, txBuilder, wallet1, wallet1Address, wallet1Collateral, wallet1Utxos, wallet1VK } from "../setup.js";
import { CollateralDatum } from "../types.js";
import { getLoanPositionDetails, getUserDepositUtxo } from "../utils.js";
import { UnifiedControlValidatorHash } from "../UnifiedControl/validator.js";
import { LoanNftValidator } from "./validator.js";
import { MintStPolicy, MintStValidatorScript } from "../StMinting/validator.js";

const collateralValScriptTxHash = "91405b0186ac0632690a5fcef34d971c8a71c9c4168d2f36662a42846776c766";
const collateralValScriptTxIndex = 0;

const allCollateralValidatorUtxos = await blockchainProvider.fetchAddressUTxOs(CollateralValidatorAddr);
const collateralUtxos = allCollateralValidatorUtxos.filter(utxo => {
  const plutusData = utxo.output.plutusData;
  if (!plutusData) return false;
  const datum = deserializeDatum<CollateralDatum>(plutusData);
  return !!datum.fields[7];
});

const collateralUtxo = collateralUtxos[0];
const collateralUtxoDetails = getLoanPositionDetails(collateralUtxo);
if (!collateralUtxoDetails) {
    throw new Error(`Could not get the loan position details of utxo: ${collateralUtxo}`);
}
const {
  st_borrowed,
  loan_nft_pid,
} = collateralUtxoDetails;

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

// Get loan NFT asset details
const loanNFTData = await blockchainProvider.get(
    "assets/" + userLoanNFTUnit
);
const loanNFTTxHash = loanNFTData.data.first_mint_tx.tx_hash;
// Get the collateral utxo transaction data
const txData = await blockchainProvider.get(
    "transactions/" + loanNFTTxHash,
);
// Get the utxo to use to reconstruct the loanNftValidatorScript
const LnvsUtxo = (txData.data.inputs.filter((input: any) => (
    input.address == CollateralValidatorAddr
)))[0]
if (!LnvsUtxo) {
    throw new Error("LnvsUtxo not found");
}
console.log("CollateralValidatorAddr:", CollateralValidatorAddr);
console.log("txData:", txData);
console.log("txData Input:", LnvsUtxo);
// Reconstruct the loanNftValidatorScript
const paramUtxo = outputReference(LnvsUtxo.tx_hash, LnvsUtxo.index);
const recLoanNftValidatorScript = applyParamsToScript(
  LoanNftValidator[0].compiledCode,
  [
      paramUtxo,
      builtinByteString(CollateralValidatorHash),
      builtinByteString(UnifiedControlValidatorHash),
  ],
  "JSON"
);

const userBalanceDatum = mConStr1([
    wallet1VK,
]);

const userDepositUtxo = getUserDepositUtxo();
// Add lovelace quantity of user balance to the collateral amount (first asset is always ADA)
const userBalanceUpdated = Number(userDepositUtxo.output.amount[0].quantity) + Number(collateralUtxo.output.amount[0].quantity);

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
        userDepositUtxo.input.txHash,
        userDepositUtxo.input.outputIndex,
        userDepositUtxo.output.amount,
        userDepositUtxo.output.address,
    )
    .spendingTxInReference(collateralValScriptTxHash, collateralValScriptTxIndex)
    // .txInScript(CollateralValidatorScript)
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
    .spendingTxInReference(collateralValScriptTxHash, collateralValScriptTxIndex)
    // .txInScript(CollateralValidatorScript)
    .spendingReferenceTxInInlineDatumPresent()
    .spendingReferenceTxInRedeemerValue(mConStr0([]))
    // burns the loan NFT
    .mintPlutusScriptV3()
    .mint("-1", userLoanNFTUnit.slice(0, 56), userLoanNFTUnit.slice(56))
    .mintingScript(recLoanNftValidatorScript)
    .mintRedeemerValue(mConStr1([]))
    // burns the loan tokens (stable coin)
    .mintPlutusScriptV3()
    .mint("-".concat(String(st_borrowed)), MintStPolicy, StStableAssetName)
    // .mintTxInReference(mintLoanScriptTxHash, mintLoanScriptTxIndex)
    .mintingScript(MintStValidatorScript)
    .mintRedeemerValue(mConStr1([]))
    // send updated user balance (with the unlocked collateral amount)
    .txOut(CollateralValidatorAddr, [{ unit: "lovelace", quantity: String(userBalanceUpdated) }, { unit: identifierTokenUnit, quantity: "1" }])
    .txOutInlineDatumValue(userBalanceDatum)
    .txInCollateral(
        wallet1Collateral.input.txHash,
        wallet1Collateral.input.outputIndex,
        wallet1Collateral.output.amount,
        wallet1Collateral.output.address,
    )
    .requiredSignerHash(wallet1VK)
    .changeAddress(wallet1Address)
    .selectUtxosFrom(wallet1Utxos)
    .complete()

const signedTx = await wallet1.signTx(unsignedTx);
const txHash = await wallet1.submitTx(signedTx);

console.log('Repayment tx hash:', txHash);
