import { applyCborEncoding, applyParamsToScript, builtinByteString, integer, outputReference, resolveScriptHash, serializePlutusScript, stringToHex } from "@meshsdk/core";
import { blockchainProvider, blueprint, multisigHash, wallet1Utxos } from "../setup.js";
import { parameterizedScript as protocolParametersScript, scriptAddr as protocolParametersAddress } from "../ProtocolParameter/validator.js";

// Oracle
const oracleScript = applyCborEncoding("5857010100323232323225333002323232323253330073370e900118041baa00113233224a060160026016601800260126ea800458c024c02800cc020008c01c008c01c004c010dd50008a4c26cacae6955ceaab9e5742ae89");
const oracleScriptHash = resolveScriptHash(oracleScript, "V3");
const oracleAddress = serializePlutusScript(
    { code: oracleScript, version: "V3" }
).address;

// Protocol parameters
const protocolParametersAddressUtxos = await blockchainProvider.fetchAddressUTxOs(protocolParametersAddress);
console.log('protocol parameters utxo:', protocolParametersAddressUtxos);
const protocolParametersUtxo = protocolParametersAddressUtxos[1];
const protocolParametersScriptHash = resolveScriptHash(protocolParametersScript, "V3");

// Collateral validator
const collateralValidatorCode = blueprint.validators.filter((val) => val.title.includes('collateral_validator.spend'));
if (!collateralValidatorCode) {
    throw new Error('Collateral Validator not found!');
}
const collateralValidatorScript = applyParamsToScript(
    collateralValidatorCode[0].compiledCode,
    [
        builtinByteString(protocolParametersScriptHash),
        builtinByteString(oracleScriptHash),
        builtinByteString(multisigHash),
    ],
    "JSON"
);
const collateralValidatorAddress = serializePlutusScript(
    { code: collateralValidatorScript, version: 'V3' },
).address;
const collateralValidatorScriptHash = resolveScriptHash(collateralValidatorScript, "V3");

// Mint loan validator
const mintLoanValidatorCode = blueprint.validators.filter((val) => val.title.includes('mint_loan_validator.mint'));
if (!mintLoanValidatorCode) {
    throw new Error('Mint loan Validator not found!');
}
const mintLoanValidatorScript = applyParamsToScript(
    mintLoanValidatorCode[0].compiledCode,
    [builtinByteString(collateralValidatorScriptHash)],
    "JSON"
);
const mintLoanValidatorAddress = serializePlutusScript(
    { code: mintLoanValidatorScript, version: 'V3' },
).address;
const mintLoanScriptHash = resolveScriptHash(mintLoanValidatorScript, "V3");
const mintLoanPolicyId = mintLoanScriptHash;
const mintLoanAssetNameHex = stringToHex("tUSD");
const mintLoanUnit = mintLoanPolicyId + mintLoanAssetNameHex;

// Oracle (contnd)
const oracleAddressUtxos = await blockchainProvider.fetchAddressUTxOs(oracleAddress);
const oracleUtxo  = oracleAddressUtxos.find((utxo) => (
    (utxo.output.amount.length > 1)
    ? (utxo.output.amount[1].unit == mintLoanUnit && utxo.output.amount[1].quantity == "24")
    : false
));
const oracleUtxoForLiquidation  = oracleAddressUtxos.find((utxo) => (
    (utxo.output.amount.length > 1)
    ? (utxo.output.amount[1].unit == mintLoanUnit && utxo.output.amount[1].quantity == "12")
    : false
));
// console.log('oracleUtxoForLiquidation:', oracleUtxo);
// console.log('oracleUtxoForLiquidation?.output.amount:', oracleUtxo?.output.amount);

// Loan NFT validator
const loanNftValidatorCode = blueprint.validators.filter((val) => val.title.includes('loan_nft_validator.mint'));
if (!loanNftValidatorCode) {
    throw new Error('Loan NFT Validator not found!');
}
// TODO: aBorrowInput will be automatically selected in from the user's wallet
//   search for an ada only utxo, if not available, use the next one with the lowest no. of assets
const aBorrowInput = (await blockchainProvider.fetchUTxOs(
    '97ebe981672be1c2a2339aab5400d4c620994db97e6787d075db5724757906e0',
    2,
))[0];
const paramUtxo = outputReference(aBorrowInput.input.txHash, aBorrowInput.input.outputIndex);
// TODO: Find a way to save this script or get it to reuse during repayment
const loanNftValidatorScript = applyParamsToScript(
    loanNftValidatorCode[0].compiledCode,
    [
        paramUtxo,
        builtinByteString(collateralValidatorScriptHash),
        builtinByteString(protocolParametersScriptHash),
        builtinByteString(oracleScriptHash),
    ],
    "JSON"
);
const loanNftValidatorAddress = serializePlutusScript(
    { code: loanNftValidatorScript, version: 'V3' },
).address;
const loanNftPolicyId = resolveScriptHash(loanNftValidatorScript, "V3");

// Utils
// console.log('LIQUIDITY POOL UTXOS:', mintLoanUtxos);
// console.log('mintLoanValidatorAddress:', mintLoanValidatorAddress);
// console.log('mintLoanInput:', mintLoanInput);
// console.log('oracleUtxo:', oracleUtxo);
// console.log('protocolParametersUtxo:', protocolParametersUtxo);

export {
    aBorrowInput,
    oracleAddress,
    mintLoanValidatorScript,
    mintLoanValidatorAddress,
    mintLoanScriptHash,
    loanNftPolicyId,
    loanNftValidatorScript,
    collateralValidatorAddress,
    collateralValidatorScript,
    mintLoanUnit,
    mintLoanPolicyId,
    mintLoanAssetNameHex,
    oracleUtxo,
    oracleUtxoForLiquidation,
    protocolParametersUtxo,
    // For lucid
    mintLoanValidatorCode,
    loanNftValidatorCode,
    protocolParametersAddress,
    collateralValidatorScriptHash,
    protocolParametersScriptHash,
    oracleScriptHash,
}
