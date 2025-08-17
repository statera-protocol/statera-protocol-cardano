import { deserializeDatum, hexToBytes, hexToString, MaestroProvider, NativeScript, resolveNativeScriptHash, serializeNativeScript, UTxO } from "@meshsdk/core";
import { CollateralDatum, DepositDatum, OracleDatum, ProtocolParametersDatum } from "./types";
import { UnifiedControlValidatorAddr, UnifiedControlValidatorHash } from "./UnifiedControl/validator";
import { CollateralValidatorAddr } from "./CollateralValidator/validator";
import { setup } from "./setup";
import { MintStPolicy } from "./StMinting/validator";
import { LoanPosition } from "@/types";

const maestroKey = process.env.NEXT_PUBLIC_MAESTRO_KEY;
if (!maestroKey) {
  throw new Error("MAESTRO_KEY does not exist");
}
const blockchainProvider = new MaestroProvider({
  network: 'Preprod',
  apiKey: maestroKey,
});

const { StPparamsAssetName, StOracleAssetName, StLiquidationAssetName, multiSigHash, multiSigAddress } = setup();

// Constant
const precisionFactor = 10000000; // 10 million

// Get multiSig details
type MultiSigDetailsType = {
  multiSigHash: string;
  multiSigAddress: string;
  multiSigUtxos: UTxO[];
};

const getMultiSigDetails = async (): Promise<MultiSigDetailsType> => {
  const multiSigUtxos = await blockchainProvider.fetchAddressUTxOs(multiSigAddress);

  return {
    multiSigHash, multiSigAddress, multiSigUtxos
  };
}

// filter deposit UTxOs with user's vkh
const getUserDepositUtxo = async (walletVK: string) => {
  const collateralUtxos = await blockchainProvider.fetchAddressUTxOs(CollateralValidatorAddr);

  const userDepositUtxos = collateralUtxos.filter((utxo) => {
    const datumData = utxo.output.plutusData
    if (!datumData) {
        return false;
    }
    const datum = deserializeDatum<DepositDatum>(datumData);

    if ((datum.fields.length === 1) && (datum.fields[0].bytes === walletVK)) {
        return true;
    }
  });

  return userDepositUtxos[0];
}

// filter loan UTxOs with user's wallet utxos
const getUserLoanUtxos = async (walletUtxos: UTxO[]) => {
  const collateralUtxos = await blockchainProvider.fetchAddressUTxOs(CollateralValidatorAddr);

  let userLoanPositions: LoanPosition[] = [];

  const userLoanUtxos = collateralUtxos.filter((utxo) => {
    const datumData = utxo.output.plutusData
    if (!datumData) {
        return false;
    }
    const datum = deserializeDatum<CollateralDatum>(datumData);

    if (!((datum.fields.length === 8) && (datum.fields[0].bytes === MintStPolicy))) {
        return false;
    }

    const loanNftUnit = datum.fields[3].bytes + datum.fields[4].bytes;

    let isNftInUserWallet = walletUtxos.find(utxo => utxo.output.amount.find(amt => amt.unit === loanNftUnit));

    if (isNftInUserWallet) {
      const collateralToken = hexToString(datum.fields[6].fields[2].bytes) === 'lovelace' ? 'ada' : hexToString(datum.fields[6].fields[2].bytes);
      const collateralTokenUnit = datum.fields[6].fields[1].bytes + datum.fields[6].fields[2].bytes;
      let collateralAmount = collateralToken === 'ada' ? Number(utxo.output.amount[0].quantity) : (() => { const theAmt = utxo.output.amount.find(amt => amt.unit === collateralTokenUnit); return (Number(theAmt?.quantity) ?? 0) })();
      collateralAmount /= 1000000;
      const mintedST = Number(datum.fields[2].int) / 1000000;

      const [assetUsdRatePrecised, minCollateral] = getMinCollateral(mintedST, collateralTokenUnit);
      const assetUsdRate = assetUsdRatePrecised / precisionFactor;
      const collateralUsdAmount = collateralAmount * assetUsdRate;
      // Using a mock Liquidation ratio of 0.8
      const healthFactor = (collateralUsdAmount * 0.8) / mintedST;

      const newPosition: LoanPosition = {
        id: loanNftUnit, // loanNFT unit is unique for each loan so it can be used as an ID
        collateralToken,
        collateralAmount,
        mintedST,
        healthFactor,
        createdAt: new Date("2025-08-17T00:00:00Z"),
        collateralUtxo: utxo,
      };

      userLoanPositions = [...userLoanPositions, newPosition];
      return true;
    }
  });

  return userLoanPositions;
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
const getPParamsUtxo = () => {
    if (!protocolParametersUtxo) throw new Error("pParamsUtxo doesn't exist");
    return protocolParametersUtxo;
}

// Oracle UTxO
const oracleUtxo = UCVUtxos.find(utxo => {
    const oracleNft = utxo.output.amount.find(
        ast => ast.unit == UnifiedControlValidatorHash + StOracleAssetName
    );
    return !!oracleNft;
});
const getOracleUtxo = () => {
    if (!oracleUtxo) throw new Error("oracleUtxo doesn't exist");
    return oracleUtxo;
}

// Liq UTxO
const liqUtxo = UCVUtxos.find(utxo => {
    const liqNft = utxo.output.amount.find(
        ast => ast.unit == UnifiedControlValidatorHash + StLiquidationAssetName
    );
    return !!liqNft;
});
const getLiqUtxo = () => {
    if (!liqUtxo) throw new Error("liqUtxoTemp doesn't exist");
    return liqUtxo;
}

// Get the maximum amount of sUSD a user can mint relative to the LTV and collateral amount provided
const getMinCollateral = (
  stBorrowed: number,
  collateralAssetUnit: string,
) => {
  if (oracleUtxo && protocolParametersUtxo) {
    const oraclePlutusData = oracleUtxo.output.plutusData;
    if (!oraclePlutusData) throw new Error("no oracle datum");
    const oracleDatum = deserializeDatum<OracleDatum>(oraclePlutusData);

    const assetRate = oracleDatum.fields[0].list.find(
      (rate) => rate.fields[0].bytes == collateralAssetUnit
    );
    if (!assetRate) throw new Error("asset rate not found");

    const pParamsPlutusData = protocolParametersUtxo.output.plutusData;
    if (!pParamsPlutusData) throw new Error("no pParams datum");
    const pParamsDatum = deserializeDatum<ProtocolParametersDatum>(pParamsPlutusData);

    const loan_to_value_ratio = Number(pParamsDatum.fields[0].int);

    const assetUsdRatePrecised = (Number(assetRate.fields[1].int) * precisionFactor) / Number(assetRate.fields[2].int);

    const collateralAmount =
      stBorrowed / (assetUsdRatePrecised / precisionFactor);

    const minCollateral = (collateralAmount * 100) / loan_to_value_ratio;

    return [assetUsdRatePrecised, minCollateral];
  } else {
    throw new Error('Oracle Utxo or Protocol Paramters Utxo not found');
  }
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

const collateralUtxos = await blockchainProvider.fetchAddressUTxOs(CollateralValidatorAddr);
// const poolUtxos = await blockchainProvider.fetchAddressUTxOs(PoolValidatorAddr);
// const orderUtxos = await blockchainProvider.fetchAddressUTxOs(OrderValidatorAddr);
// const UnifiedControlUtxos = await blockchainProvider.fetchAddressUTxOs(UnifiedControlValidatorAddr);

export {
  getUserDepositUtxo,
  getUserLoanUtxos,
  getPParamsUtxo,
  getOracleUtxo,
  getLiqUtxo,
  getMinCollateral,
  getLoanPositionDetails,
  getMultiSigDetails,
  collateralUtxos,
}
