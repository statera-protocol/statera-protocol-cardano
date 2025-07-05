import { deserializeDatum, UTxO } from "@meshsdk/core";
import { CollateralDatum, DepositDatum, OracleDatum, ProtocolParametersDatum } from "./types.js";
import { blockchainProvider, StOracleAssetName, StPparamsAssetName, wallet1VK } from "./setup.js";
import { UnifiedControlValidatorAddr, UnifiedControlValidatorHash } from "./UnifiedControl/validator.js";
import { CollateralValidatorAddr } from "./CollateralValidator/validator.js";

// get all collateral UTxOs
const collateralUtxos = await blockchainProvider.fetchAddressUTxOs(CollateralValidatorAddr);
// filter deposit UTxOs with user's vkh
const userDepositUtxos = collateralUtxos.filter((utxo) => {
    const datumData = utxo.output.plutusData
    if (!datumData) {
        return false;
    }
    const datum = deserializeDatum<DepositDatum>(datumData);

    // wallet1VK should be of the logged in user's wallet -> Dynamic
    if ((datum.fields.length == 1) && (datum.fields[0].bytes == wallet1VK)) {
        return true;
    }
});
const getUserDepositUtxo = () => {
  if (!userDepositUtxos) throw new Error('No user deposit in protocol');
  return userDepositUtxos[0];
}

const UCVUtxos = await blockchainProvider.fetchAddressUTxOs(UnifiedControlValidatorAddr);
// console.log("UCVUtxos:", UCVUtxos, '\n', UCVUtxos.length);

// Protocol Parameters UTxO
const protocolParametersUtxo = UCVUtxos.find(utxo => {
    const pParamsNft = utxo.output.amount.find(
        ast => ast.unit == UnifiedControlValidatorHash + StPparamsAssetName
    );
    return !!pParamsNft;
});
if (!protocolParametersUtxo) throw new Error("pParamsUtxo doesn't exist");
const pParamsUtxo = protocolParametersUtxo;
// console.log("pParamsUtxo:", pParamsUtxo);

// Oracle UTxO
const oracleUtxoTemp = UCVUtxos.find(utxo => {
    const oracleNft = utxo.output.amount.find(
        ast => ast.unit == UnifiedControlValidatorHash + StOracleAssetName
    );
    return !!oracleNft;
});
if (!oracleUtxoTemp) throw new Error("oracleUtxo doesn't exist");
const oracleUtxo = oracleUtxoTemp;
// console.log("oracleUtxo:", oracleUtxo);

const precisionFactor = 10000000; // 10 million

// Get the maximum amount of sUSD a user can mint relative to the LTV and collateral amount provided
const getMaxStMint = (
  collateralAmmountInLovelaces: number,
  collateralAssetUnit: string,
) => {
  const oraclePlutusData = oracleUtxo.output.plutusData;
  if (!oraclePlutusData) throw new Error("no oracle datum");
  const oracleDatum = deserializeDatum<OracleDatum>(oraclePlutusData);

  const assetRate = oracleDatum.fields[0].list.find(
    (rate) => rate.fields[0].bytes == collateralAssetUnit
  );
  if (!assetRate) throw new Error("asset rate not found");

  const pParamsPlutusData = pParamsUtxo.output.plutusData;
  if (!pParamsPlutusData) throw new Error("no pParams datum");
  const pParamsDatum = deserializeDatum<ProtocolParametersDatum>(pParamsPlutusData);

  const loan_to_value_ratio = Number(pParamsDatum.fields[0].int);

  const assetUsdRatePrecised = (Number(assetRate.fields[1].int) * precisionFactor) / Number(assetRate.fields[2].int);

  const lovelaceUsdValue =
    collateralAmmountInLovelaces * (assetUsdRatePrecised / precisionFactor);

  const maxStMint = (lovelaceUsdValue * loan_to_value_ratio) / 100;

  return [assetUsdRatePrecised, maxStMint];
}

const getLoanPositionDetails = (loanPosition: UTxO) => {
    const datumData = loanPosition.output.plutusData
    if (!datumData) {
        return false;
    }

    const datum = deserializeDatum<CollateralDatum>(datumData);
    if (datum.fields.length < 8 || !Object.hasOwn(datum.fields[4], "bytes")) {
        return false;
    }

    return {
        st_policy_id: datum.fields[0].bytes,
        st_asset_name: datum.fields[1].bytes,
        st_borrowed: datum.fields[2].int,
        loan_nft_pid: datum.fields[3].bytes,
        loan_nft_asset_name: datum.fields[4].bytes,
        collateral_rate_at_lending_precised: datum.fields[5].int,
        collateral_asset: datum.fields[6],
        collateral_asset_amount: datum.fields[7].int,
    }
}

export {
  getUserDepositUtxo,
  pParamsUtxo,
  oracleUtxo,
  getMaxStMint,
  getLoanPositionDetails,
}
