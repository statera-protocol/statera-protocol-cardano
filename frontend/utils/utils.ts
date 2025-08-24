import { deserializeDatum, hexToBytes, hexToString, IWallet, MaestroProvider, NativeScript, resolveNativeScriptHash, serializeAddressObj, serializeNativeScript, toUTF8, UTxO } from "@meshsdk/core";
import { CollateralDatum, DepositDatum, OracleDatum, OrderDatumType, ProtocolParametersDatum } from "./types";
import { UnifiedControlValidatorAddr, UnifiedControlValidatorHash } from "./UnifiedControl/validator";
import { CollateralValidatorAddr } from "./CollateralValidator/validator";
import { setup } from "./setup";
import { MintStPolicy } from "./StMinting/validator";
import { CollateralToken, LoanPosition, SwapOrder } from "@/types";
import { OrderValidatorAddr } from "./Batching/validators";

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
      const collateralToken = hexToString(datum.fields[6].fields[2].bytes) === 'lovelace' ? 'ADA' : hexToString(datum.fields[6].fields[2].bytes);
      const collateralTokenUnit = datum.fields[6].fields[1].bytes + datum.fields[6].fields[2].bytes;
      let collateralAmount = collateralToken === 'ADA' ? Number(utxo.output.amount[0].quantity) : (() => { const theAmt = utxo.output.amount.find(amt => amt.unit === collateralTokenUnit); return (Number(theAmt?.quantity) ?? 0) })();
      collateralAmount /= 1000000;
      const mintedST = Number(datum.fields[2].int) / 1000000;

      const assetUsdRate = Number(getAssetPrice(collateralTokenUnit));
      const collateralUsdAmount = collateralAmount * assetUsdRate;
      const { minLiquidationThreshold } = getProtocolParamters();
      const healthFactor = (collateralUsdAmount / (mintedST * (minLiquidationThreshold / 100))) * 1.25; // multiplied by a buffer for the healthFactor

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

// get user balances
const getUserBalances = async (wallet: IWallet) => {
  const { assetObject } = setup();

  const balance = await wallet.getBalance();
  const iUSDBalance = balance.find(bal => bal.unit === assetObject["iUSD"].unit);
  const USDMBalance = balance.find(bal => bal.unit === assetObject["USDM"].unit);
  const STBalance = balance.find(bal => bal.unit === assetObject["ST"].unit);

  return {
    iUSDBalance: Number(iUSDBalance?.quantity ?? "") / 1000000,
    USDMBalance: Number(USDMBalance?.quantity ?? "") / 1000000,
    STBalance: Number(STBalance?.quantity ?? "") / 1000000,
  };
}

// get user swap orders
const getUserSwapOrders = async (address: string) => {
  const orderUtxos = await blockchainProvider.fetchAddressUTxOs(OrderValidatorAddr);
  let swapOrders: SwapOrder[] = [];

  const userOrderUtxos = orderUtxos.filter(utxo => {
    const datumData = utxo.output.plutusData
    if (!datumData) {
        return false;
    }
    const datum = deserializeDatum<OrderDatumType>(datumData);

    if (!(datum.fields.length === 4)) return false;

    const addrInUtxo = serializeAddressObj(datum.fields[1]);

    if (addrInUtxo === address) {
      const canceller = datum.fields[2].bytes;

      const orderType = datum.fields[0].constructor;
      const tokenPid = datum.fields[3].fields[1].bytes;
      const tokenName = datum.fields[3].fields[2].bytes;

      let fromToken = "";
      let toToken = "";
      let amount = 0;

      if (orderType === 0) {
        fromToken = toUTF8(tokenName);
        toToken = "ST";
        const amountAsset = utxo.output.amount.find(amt => amt.unit === (tokenPid + tokenName));
        amount = Number(amountAsset?.quantity ?? '') / 1000000;
      } else {
        fromToken = "ST";
        toToken = toUTF8(tokenName);

        const { assetObject } = setup();
        const amountAsset = utxo.output.amount.find(amt => amt.unit === assetObject["ST"].unit);
        amount = Number(amountAsset?.quantity ?? '') / 1000000;
      }

      const newSwapOrder: SwapOrder = {
        id: utxo.input.txHash + utxo.input.outputIndex,
        fromToken,
        toToken,
        fromAmount: amount,
        expectedToAmount: amount,
        rate: 1.00,
        timestamp: new Date(),
        status: 'pending',
        canceller,
        utxo,
      }

      swapOrders = [...swapOrders, newSwapOrder];

      return true;
    }
  });

  return swapOrders;
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

// Get an asset's price
const getAssetPrice = (
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

    const assetUsdRatePrecised = (Number(assetRate.fields[1].int) * precisionFactor) / Number(assetRate.fields[2].int);

    return Number(assetUsdRatePrecised / precisionFactor).toFixed(2);
  } else {
    throw new Error('Oracle Utxo not found');
  }
}

// get protocol parameters
const getProtocolParamters = () => {
  if (!protocolParametersUtxo) throw new Error("protocol parameters utxo doesn't exist");

  const pParamsPlutusData = protocolParametersUtxo.output.plutusData;
  if (!pParamsPlutusData) throw new Error("no pParams datum");
  const pParamsDatum = deserializeDatum<ProtocolParametersDatum>(pParamsPlutusData);

  const stAsset = {
    isStable: pParamsDatum.fields[5].fields[0].constructor === 0 ? false : true,
    policyId: pParamsDatum.fields[5].fields[1].bytes,
    assetName: pParamsDatum.fields[5].fields[2].bytes,
  };

  const collateralAssets = pParamsDatum.fields[6].list.map(ast => {
    return {
      isStable: ast.fields[0].constructor === 0 ? false : true,
      policyId: ast.fields[1].bytes,
      assetName: ast.fields[2].bytes,
    };
  });

  const swappableAssets = pParamsDatum.fields[7].list.map(ast => {
    return {
      isStable: ast.fields[0].constructor === 0 ? false : true,
      policyId: ast.fields[1].bytes,
      assetName: ast.fields[2].bytes,
    };
  });

  const authorizedBatchers = pParamsDatum.fields[8].list.map(b => b.bytes);

  return {
    loanToValueRatio: Number(pParamsDatum.fields[0].int),
    minCollateralRatio: Number(pParamsDatum.fields[1].int),
    minLiquidationThreshold: Number(pParamsDatum.fields[2].int),
    minLoanAmount: Number(pParamsDatum.fields[3].int),
    protocolUsageFee: Number(pParamsDatum.fields[4].int),
    stAsset,
    collateralAssets,
    swappableAssets,
    authorizedBatchers,
    admin: pParamsDatum.fields[9].bytes,
  };
}

// get collateral and swap tokens
const getCollateralAndSwapTokens = () => {
  const { collateralAssets, swappableAssets, loanToValueRatio, minLiquidationThreshold } = getProtocolParamters();

  const allowedCollateralTokens: CollateralToken[] = collateralAssets.map(ast => ({
    symbol: toUTF8(ast.assetName) === 'lovelace' ? 'ADA' : toUTF8(ast.assetName),
    name: 'Cardano',
    price: Number(getAssetPrice(ast.policyId + ast.assetName)),
    maxLTV: loanToValueRatio,
    liquidationThreshold: minLiquidationThreshold,
  }));

  const swappableTokens: string[] = swappableAssets.map(ast => toUTF8(ast.assetName));
  swappableTokens.push('ST');

  return {
    allowedCollateralTokens,
    swappableTokens,
  };
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
  getUserBalances,
  getUserSwapOrders,
  getAssetPrice,
  getProtocolParamters,
  getCollateralAndSwapTokens,
  getPParamsUtxo,
  getOracleUtxo,
  getLiqUtxo,
  getMinCollateral,
  getLoanPositionDetails,
  getMultiSigDetails,
  collateralUtxos,
}
