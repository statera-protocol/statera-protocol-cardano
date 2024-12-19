import { applyCborEncoding, applyParamsToScript, builtinByteString, outputReference, resolveScriptHash, serializePlutusScript } from "@meshsdk/core";
import { blockchainProvider, blueprint, wallet1Utxos } from "../setup.js";
import { parameterizedScript as protocolParametersScript, scriptAddr as protocolParametersAddress } from "../ProtocolParameter/validator.js";

// Oracle
const oracleScript = applyCborEncoding("5857010100323232323225333002323232323253330073370e900118041baa00113233224a060160026016601800260126ea800458c024c02800cc020008c01c008c01c004c010dd50008a4c26cacae6955ceaab9e5742ae89");
const oracleScriptHash = resolveScriptHash(oracleScript, "V3");
const oracleAddress = serializePlutusScript(
    { code: oracleScript, version: "V3" }
).address;
const tUsdPolicyId = "b2af4d6208ee4114c74dc01b7111ba1df61a94a2d7d2fd7c473b139f";
const tUsdAssetNameHex = "74555344";
const tUSDUnit = tUsdPolicyId + tUsdAssetNameHex;
const oracleAddressUtxos = await blockchainProvider.fetchAddressUTxOs(oracleAddress);
const oracleUtxo  = oracleAddressUtxos.find((utxo) => (
    (utxo.output.amount.length > 1)
    ? (utxo.output.amount[1].unit == tUSDUnit && utxo.output.amount[1].quantity == "24")
    : false
));
const oracleUtxoForLiquidation  = oracleAddressUtxos.find((utxo) => (
    (utxo.output.amount.length > 1)
    ? (utxo.output.amount[1].unit == tUSDUnit && utxo.output.amount[1].quantity == "12")
    : false
));
console.log(oracleUtxoForLiquidation);
console.log(oracleUtxoForLiquidation?.output.amount);

// Protocol parameters
const protocolParametersAddressUtxos = await blockchainProvider.fetchAddressUTxOs(protocolParametersAddress);
const protocolParametersUtxo = protocolParametersAddressUtxos[0];
const protocolParametersScriptHash = resolveScriptHash(protocolParametersScript, "V3");

// Collateral validator
const collateralValidatorCode = blueprint.validators.filter((val) => val.title.includes('collateral_validator.spend'));
if (!collateralValidatorCode) {
    throw new Error('Collateral Validator not found!');
}
const collateralValidatorScript = applyParamsToScript(
    collateralValidatorCode[0].compiledCode,
    [builtinByteString(protocolParametersScriptHash), builtinByteString(oracleScriptHash)],
    "JSON"
);
const collateralValidatorAddress = serializePlutusScript(
    { code: collateralValidatorScript, version: 'V3' },
).address;
const collateralValidatorScriptHash = resolveScriptHash(collateralValidatorScript, "V3");

// Liquidity pool validator
const liquidityPoolValidatorCode = blueprint.validators.filter((val) => val.title.includes('liquidity_pool.spend'));
if (!liquidityPoolValidatorCode) {
    throw new Error('Liquidity Pool Validator not found!');
}
const liquidityPoolValidatorScript = applyParamsToScript(
    liquidityPoolValidatorCode[0].compiledCode,
    [builtinByteString(collateralValidatorScriptHash)],
    "JSON"
);
const liquidityPoolValidatorAddress = serializePlutusScript(
    { code: liquidityPoolValidatorScript, version: 'V3' },
).address;
const liquidityPoolScriptHash = resolveScriptHash(liquidityPoolValidatorScript, "V3");

// Loan NFT validator
const loanNftValidatorCode = blueprint.validators.filter((val) => val.title.includes('loan_nft.mint'));
if (!loanNftValidatorCode) {
    throw new Error('Loan NFT Validator not found!');
}
const aBorrowInput = (await blockchainProvider.fetchUTxOs(
    '6119b07097effc1520e0d5a096862600e81457b4c7c64b78532926034b22e1cd',
    3,
))[0];
const paramUtxo = outputReference(aBorrowInput.input.txHash, aBorrowInput.input.outputIndex);
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
const liquidityPoolUtxos = await blockchainProvider.fetchAddressUTxOs(liquidityPoolValidatorAddress);
const liquidityPoolInput = liquidityPoolUtxos[0];
// console.log('LIQUIDITY POOL UTXOS:', liquidityPoolUtxos);
// console.log('liquidityPoolValidatorAddress:', liquidityPoolValidatorAddress);
// console.log('liquidityPoolInput:', liquidityPoolInput);
// console.log('oracleUtxo:', oracleUtxo);
// console.log('protocolParametersUtxo:', protocolParametersUtxo);

export {
    aBorrowInput,
    oracleAddress,
    liquidityPoolInput,
    liquidityPoolValidatorScript,
    liquidityPoolValidatorAddress,
    liquidityPoolScriptHash,
    loanNftPolicyId,
    loanNftValidatorScript,
    collateralValidatorAddress,
    collateralValidatorScript,
    tUSDUnit,
    tUsdPolicyId,
    tUsdAssetNameHex,
    oracleUtxo,
    oracleUtxoForLiquidation,
    protocolParametersUtxo,
    // For lucid
    liquidityPoolValidatorCode,
    loanNftValidatorCode,
    protocolParametersAddress,
    collateralValidatorScriptHash,
    protocolParametersScriptHash,
    oracleScriptHash,
}
