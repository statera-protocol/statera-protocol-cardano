import { mConStr, mConStr0, mConStr1, stringToHex } from "@meshsdk/core";
import { assetObject, collateralScriptIdx, collateralScriptTxHash, StStableAssetName, txBuilder, wallet1, wallet1Address, wallet1Collateral, wallet1Utxos, wallet1VK } from "../setup.js";
import { CollateralValidatorAddr, identifierTokenUnit } from "../CollateralValidator/validator.js";
import { LoanNftPolicy, LoanNftValidatorScript } from "./validator.js";
import { MintStPolicy, MintStValidatorScript, stUnit } from "../StMinting/validator.js";
import { getMaxStMint, getOracleUtxo, getPParamsUtxo, getUserDepositUtxo } from "../utils.js";

const oracleUtxo = getOracleUtxo();
const pParamsUtxo = getPParamsUtxo();

const userDepositUtxo = getUserDepositUtxo();
console.log("userDepositUtxo:", userDepositUtxo);
const loanNftName = "st-loan" + "-" + (String(userDepositUtxo.input.txHash).slice(0, 5) + "#" + String(userDepositUtxo.input.outputIndex));
// const loanNftName = "St-New-Model-Liquidation";
const loanNftNameHex = stringToHex(loanNftName);
const loanNftUnit = LoanNftPolicy + loanNftNameHex;

const collateralAmmountInLovelaces = "135000000"; // 135 ADA
const stBorrowed = 110000000;
// const stBorrowed = 129600000;

const [assetUsdRatePrecised, maxStMint] = getMaxStMint(
    Number(collateralAmmountInLovelaces),
    assetObject.ada.unit,
);

if (stBorrowed > maxStMint) throw new Error("You can't mint more than allowed amount");

console.log("assetUsdRatePrecised:", assetUsdRatePrecised);
console.log("maxStMint:", maxStMint);
console.log("loanNftName:", loanNftName);

const changeAmount = Number(userDepositUtxo.output.amount[0].quantity) - Number(collateralAmmountInLovelaces);

const collateralDatum = mConStr0([
  MintStPolicy,
  StStableAssetName,
  stBorrowed,
  LoanNftPolicy,
  loanNftNameHex,
  assetUsdRatePrecised,
  mConStr0([
    mConStr0([]),
    assetObject.ada.policy,
    assetObject.ada.name,
  ]),
  Number(collateralAmmountInLovelaces),
]);

const depositDatum = mConStr1([
  wallet1VK
]);

const unsignedTx = await txBuilder
    // spend deposit utxo by user
    .spendingPlutusScriptV3()
    .txIn(
        userDepositUtxo.input.txHash,
        userDepositUtxo.input.outputIndex,
        userDepositUtxo.output.amount,
        userDepositUtxo.output.address,
    )
    // .txInScript(CollateralValidatorScript)
    .spendingTxInReference(collateralScriptTxHash, collateralScriptIdx)
    .spendingReferenceTxInInlineDatumPresent()
    .spendingReferenceTxInRedeemerValue(mConStr1([]))
    // mint loan NFT
    .mintPlutusScriptV3()
    .mint("1", LoanNftPolicy, loanNftNameHex)
    .mintingScript(LoanNftValidatorScript)
    .mintRedeemerValue(mConStr0([]))
    // mint loan tokens
    .mintPlutusScriptV3()
    .mint(String(stBorrowed), MintStPolicy, StStableAssetName)
    .mintingScript(MintStValidatorScript)
    .mintRedeemerValue(mConStr0([]))
    // send collateral to collateral validator address
    .txOut(CollateralValidatorAddr, [ { unit: "lovelace", quantity: collateralAmmountInLovelaces } ])
    .txOutInlineDatumValue(collateralDatum)
    // send change as deposit to collateral validator address
    .txOut(CollateralValidatorAddr, [ { unit: "lovelace", quantity: String(changeAmount) }, { unit: identifierTokenUnit, quantity: "1" } ])
    .txOutInlineDatumValue(depositDatum)
    // send loan NFT and loan tokens to borrower
    .txOut(wallet1Address, [ { unit: loanNftUnit, quantity: "1" }, { unit: stUnit, quantity: String(stBorrowed) }])
    .readOnlyTxInReference(oracleUtxo.input.txHash, oracleUtxo.input.outputIndex)
    .readOnlyTxInReference(pParamsUtxo.input.txHash, pParamsUtxo.input.outputIndex)
    // use collateral ADA for failed transactions from user's wallet address
    .txInCollateral(
        wallet1Collateral.input.txHash,
        wallet1Collateral.input.outputIndex,
        wallet1Collateral.output.amount,
        wallet1Collateral.output.address,
    )
    .changeAddress(wallet1Address)
    .requiredSignerHash(wallet1VK)
    .selectUtxosFrom(wallet1Utxos)
    // .selectUtxosFrom(userDepositUtxos)
    .complete()

const signedTx = await wallet1.signTx(unsignedTx);
const txHash = await wallet1.submitTx(signedTx);

console.log('take loan txHash:', txHash);
