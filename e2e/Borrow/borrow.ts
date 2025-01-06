import { deserializeDatum, integer, mConStr0, mConStr1, mConStr2, stringToHex } from "@meshsdk/core";
import { blockchainProvider, txBuilder, wallet1, wallet1Address, wallet1Collateral, wallet1Utxos, wallet1VK } from "../setup.js";
import { aBorrowInput, collateralValidatorAddress, loanNftPolicyId, loanNftValidatorScript, oracleUtxo, protocolParametersUtxo, mintLoanAssetNameHex, mintLoanPolicyId, mintLoanUnit, mintLoanValidatorScript, userDepositUtxos, collateralValidatorScript } from "./setup.js";
import { calculateLoanAmount, DepositDatum } from "./util.js";

if (!oracleUtxo) {
    throw new Error('Oracle UTxO not found!');
}
if (!protocolParametersUtxo) {
    throw new Error('Protocol Parameters UTxO not found!');
}

const loanNftName = "statera-borrow" + "-" + (String(userDepositUtxos[0].input.txHash).slice(0, 5) + "#" + String(userDepositUtxos[0].input.outputIndex));
// const loanNftName = "St-New-Model-Liquidation";
const loanNftNameHex = stringToHex(loanNftName);
const loanNftUnit = loanNftPolicyId + loanNftNameHex;

const collateralAmmountInLovelaces = "135000000"; // 135 ADA
const [oracleRate, loanAmount] = calculateLoanAmount(
    oracleUtxo?.output.amount,
    protocolParametersUtxo.output.plutusData,
    collateralAmmountInLovelaces,
);

console.log("loanNftName:", loanNftName);

console.log('loanAmount:', loanAmount);

const changeAmount = Number(userDepositUtxos[0].output.amount[0].quantity) - Number(collateralAmmountInLovelaces);

const collateralDatum = mConStr0([
    mintLoanPolicyId,
    mintLoanPolicyId,
    mintLoanAssetNameHex,
    loanAmount,
    loanNftPolicyId,
    (oracleRate * 1000000), // USD multiplied by ADA lovelaces bcs no decimals in blockhain
    "ada",
    Number(collateralAmmountInLovelaces),
]);

const depositDatum = mConStr1([
    wallet1VK
]);

const unsignedTx = await txBuilder
    // spend deposit utxo by user
    .spendingPlutusScriptV3()
    .txIn(
        userDepositUtxos[0].input.txHash,
        userDepositUtxos[0].input.outputIndex,
        userDepositUtxos[0].output.amount,
        userDepositUtxos[0].output.address,
    )
    .txInScript(collateralValidatorScript)
    .spendingReferenceTxInInlineDatumPresent()
    .spendingReferenceTxInRedeemerValue(mConStr2([]))
    // mint loan NFT
    .mintPlutusScriptV3()
    .mint("1", loanNftPolicyId, loanNftNameHex)
    .mintingScript(loanNftValidatorScript)
    .mintRedeemerValue(mConStr0([]))
    // mint loan tokens
    .mintPlutusScriptV3()
    .mint(String(loanAmount), mintLoanPolicyId, mintLoanAssetNameHex)
    .mintingScript(mintLoanValidatorScript)
    .mintRedeemerValue(mConStr0([]))
    // send collateral to collateral validator address
    .txOut(collateralValidatorAddress, [ { unit: "lovelace", quantity: collateralAmmountInLovelaces } ])
    .txOutInlineDatumValue(collateralDatum)
    // send change as deposit to collateral validator address
    .txOut(collateralValidatorAddress, [ { unit: "lovelace", quantity: String(changeAmount) } ])
    .txOutInlineDatumValue(depositDatum)
    // send loan NFT and loan tokens to borrower
    .txOut(wallet1Address, [ { unit: loanNftUnit, quantity: "1" }, { unit: mintLoanUnit, quantity: String(loanAmount) }])
    .readOnlyTxInReference(oracleUtxo.input.txHash, oracleUtxo.input.outputIndex)
    .readOnlyTxInReference(protocolParametersUtxo.input.txHash, protocolParametersUtxo.input.outputIndex)
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

console.log('Statera Borrow tx Hash:', txHash);
