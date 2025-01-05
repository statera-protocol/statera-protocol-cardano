import { MaestroProvider, NativeScript, resolveNativeScriptHash, serializeNativeScript, UTxO } from "@meshsdk/core";
import { applyCborEncoding, applyParamsToScript, builtinByteString, deserializeDatum, integer, outputReference, resolveScriptHash, serializePlutusScript, stringToHex } from "@meshsdk/core";
import { DepositDatum } from "./util";
import blueprint from "../../onchain/plutus.json" with { type: "json" };

export const setup = async (blockchainProvider: MaestroProvider, walletUtxos: UTxO[], walletVK: string) => {
  // Setup multisig script address where liquidated funds go to
  const nativeScript: NativeScript = {
    type: 'all',
    scripts: [
      {
        type: 'sig',
        keyHash: '96cbb27c96daf8cab890de6d7f87f5ffd025bf8ac80717cbc4fae7da'
      },
      {
        type: 'sig',
        keyHash: '96cbb27c96daf8cab890de6d7f87f5ffd025bf8ac80717cbc4fae7da'
      }
    ]
  }
  const { address: multiSigAddress, scriptCbor: multiSigCbor } = serializeNativeScript(nativeScript);
  const multisigHash = resolveNativeScriptHash(nativeScript);

  // Oracle
  const oracleScript = applyCborEncoding("5857010100323232323225333002323232323253330073370e900118041baa00113233224a060160026016601800260126ea800458c024c02800cc020008c01c008c01c004c010dd50008a4c26cacae6955ceaab9e5742ae89");
  const oracleScriptHash = resolveScriptHash(oracleScript, "V3");
  const oracleAddress = serializePlutusScript(
    { code: oracleScript, version: "V3" }
  ).address;

  // Protocol parameters
  const ProtocolParameterValidator = blueprint.validators.filter((val) => val.title.includes('protocol_parameter.spend'));
  if (!ProtocolParameterValidator) {
      throw new Error('Protocol Parameter Validator not found!');
  }
  const protocolParametersScript = applyParamsToScript(
      ProtocolParameterValidator[0].compiledCode,
      [builtinByteString(walletVK)],
      "JSON"
  );
  const protocolParametersAddress = serializePlutusScript(
      { code: protocolParametersScript, version: 'V3' },
      undefined,
      0
  ).address;
  const protocolParametersAddressUtxos = await blockchainProvider.fetchAddressUTxOs(protocolParametersAddress);
  // console.log('protocol parameters utxo:', protocolParametersAddressUtxos);
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
  // console.log("oracleUtxo:", oracleUtxo);
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

  // get all collateral UTxOs
  const collateralUtxos = await blockchainProvider.fetchAddressUTxOs(collateralValidatorAddress);
  // filter deposit UTxOs with user's vkh
  const userDepositUtxos = collateralUtxos.filter((utxo) => {
    const datumData = utxo.output.plutusData
    if (!datumData) {
        return false;
    }
    const datum = deserializeDatum<DepositDatum>(datumData);

    // wallet1VK should be of the logged in user's wallet -> Dynamic
    if ((datum.fields.length == 1) && (datum.fields[0].bytes == walletVK)) {
        return true;
    }
  });
  // console.log("userDepositUtxos:", userDepositUtxos);

  const aBorrowInput = (await blockchainProvider.fetchUTxOs(
    userDepositUtxos[0].input.txHash,
    userDepositUtxos[0].input.outputIndex,
  ))[0];
  // const aBorrowInput = "";
  const paramUtxo = outputReference(aBorrowInput.input.txHash, aBorrowInput.input.outputIndex);
  // const paramUtxo = outputReference("3c149a5500447e8f8c7a508ef47f1743da0ff2e4ef4c6d02b1a44a9888c89569", 0);
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

  return {
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
    mintLoanValidatorCode,
    loanNftValidatorCode,
    protocolParametersAddress,
    collateralValidatorScriptHash,
    protocolParametersScriptHash,
    oracleScriptHash,
    userDepositUtxos,
    multiSigAddress,
    multisigHash,
  }
}
