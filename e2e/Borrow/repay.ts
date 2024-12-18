import { BuiltinByteString, ConStr0, deserializeDatum, Integer, mConStr0, mConStr1 } from "@meshsdk/core";
import { blockchainProvider, txBuilder, wallet1, wallet1Address, wallet1Collateral, wallet1Utxos } from "../setup.js";
import { collateralValidatorAddress, collateralValidatorScript, liquidityPoolValidatorAddress, loanNftValidatorScript, oracleUtxo, protocolParametersUtxo, tUSDUnit } from "./setup.js";

if (!oracleUtxo) {
    throw new Error('Oracle UTxO not found!');
}

const loanNftUtxo = (await blockchainProvider.fetchUTxOs(
    '89e6831cf70a801147c333fb69fae2aee4d5fe80cc4785dedaa541b9432f3659',
    1
))[0];
const loanNftUtxoAmountUnits = loanNftUtxo.output.amount.map((amount) => amount.unit);

type CollateralDatum = ConStr0<[
    BuiltinByteString,
    BuiltinByteString,
    BuiltinByteString,
    Integer,
    BuiltinByteString,
    Integer,
    BuiltinByteString,
    Integer,
    Integer,
]>;

let userLoanNFTUnit = "";
let userLoanAmount = 0;

const collateralUtxos = await blockchainProvider.fetchAddressUTxOs(collateralValidatorAddress);
const collateralUtxo = collateralUtxos.find(utxo => {
    const datumData = utxo.output.plutusData
    if (!datumData) {
        return false;
    }

    const datum = deserializeDatum<CollateralDatum>(datumData);
    const loanNftPolicyId = datum.fields[4].bytes;

    for (let i = 0; i < loanNftUtxoAmountUnits.length; i++) {
        if (loanNftUtxoAmountUnits[i].slice(0, 56) == loanNftPolicyId) {
            userLoanNFTUnit = loanNftUtxoAmountUnits[i];
            userLoanAmount = Number(datum.fields[3].int);
            return true;
        }
    }
});
if (!collateralUtxo) {
    throw new Error('No collateral Utxo found for the NFT');
}

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
    .txInScript(collateralValidatorScript)
    .spendingReferenceTxInInlineDatumPresent()
    .spendingReferenceTxInRedeemerValue(mConStr0([]))
    .mintPlutusScriptV3()
    .mint("-1", userLoanNFTUnit.slice(0, 56), userLoanNFTUnit.slice(56))
    .mintingScript(loanNftValidatorScript)
    .mintRedeemerValue(mConStr1([]))
    // will fail, replace with String(userLoanAmount)
    .txOut(liquidityPoolValidatorAddress, [ { unit: tUSDUnit, quantity: String(userLoanAmount) } ])
    .txOut(wallet1Address, collateralUtxo.output.amount)
    .readOnlyTxInReference(oracleUtxo.input.txHash, oracleUtxo.input.outputIndex)
    .readOnlyTxInReference(protocolParametersUtxo.input.txHash, protocolParametersUtxo.input.outputIndex)
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

console.log('Repayment tx hash:', txHash);
