import { BuiltinByteString, conStr, conStr0, ConStr0, deserializeDatum, Integer, mConStr0, mConStr1 } from "@meshsdk/core";
import { blockchainProvider, multiSigAddress, txBuilder, wallet1, wallet1Address, wallet1Collateral, wallet1Utxos } from "../setup.js";
import { collateralValidatorAddress, collateralValidatorScript, loanNftValidatorScript, oracleUtxo, protocolParametersUtxo, mintLoanUnit, mintLoanValidatorScript, mintLoanPolicyId, mintLoanAssetNameHex } from "./setup.js";
import { CollateralDatum } from "./util.js";

if (!oracleUtxo) {
    throw new Error('Oracle UTxO not found!');
}

// TODO: In off-chain, get the policy id of NFT, use maestro to search for the NFT, and NFT tx,
//   Or get it directly from the NFT Utxos listed in the DApp
const loanNftUtxo = (await blockchainProvider.fetchUTxOs(
    '97ebe981672be1c2a2339aab5400d4c620994db97e6787d075db5724757906e0',
    1
))[0];
const loanNftUtxoAmountUnits = loanNftUtxo.output.amount.map((amount) => amount.unit);

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
console.log('collateral utxo:', collateralUtxo);

const collateralAdaAsset = collateralUtxo.output.amount.find((asset) =>
    asset.unit == "lovelace"
)
if (!collateralAdaAsset) {
    throw new Error('collateral Ada Asset not found');
}

const unsignedTx = await txBuilder
    // .txIn(
    //     loanNftUtxo.input.txHash,
    //     loanNftUtxo.input.outputIndex,
    //     loanNftUtxo.output.amount,
    //     loanNftUtxo.output.address,
    // )
    .spendingPlutusScriptV3()
    .txIn(
        collateralUtxo.input.txHash,
        collateralUtxo.input.outputIndex,
        collateralUtxo.output.amount,
        collateralUtxo.output.address,
    )
    .txInScript(collateralValidatorScript)
    .spendingReferenceTxInInlineDatumPresent()
    // .spendingReferenceTxInRedeemerValue(mConStr0([]), undefined, { mem: 70000, steps: 21000000 })
    .spendingReferenceTxInRedeemerValue(mConStr0([]), undefined, { mem: 2100000, steps: 700000000 })
    .mintPlutusScriptV3()
    .mint("-1", userLoanNFTUnit.slice(0, 56), userLoanNFTUnit.slice(56))
    .mintingScript(loanNftValidatorScript)
    // .mintRedeemerValue(mConStr1([]), undefined, { mem: 100000, steps: 29000000 })
    .mintRedeemerValue(mConStr1([]), undefined, { mem: 2100000, steps: 700000000 })
    .mintPlutusScriptV3()
    .mint("-".concat(String(userLoanAmount)), mintLoanPolicyId, mintLoanAssetNameHex)
    .mintingScript(mintLoanValidatorScript)
    .mintRedeemerValue(mConStr1([]), undefined, { mem: 2100000, steps: 700000000 })
    .txOut(wallet1Address, collateralUtxo.output.amount)
    // .txOut(wallet1Address, [{ unit: "lovelace", quantity: collateralAdaAsset.quantity }])
    // .readOnlyTxInReference(oracleUtxo.input.txHash, oracleUtxo.input.outputIndex)
    // .readOnlyTxInReference(protocolParametersUtxo.input.txHash, protocolParametersUtxo.input.outputIndex)
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
// const evaluateTx = await blockchainProvider.evaluateTx(signedTx);
// console.log('evaluate tx:', evaluateTx);
const txHash = await wallet1.submitTx(signedTx);

console.log('Repayment tx hash:', txHash);
