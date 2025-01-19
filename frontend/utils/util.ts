import { Asset, BuiltinByteString, ConStr0, ConStr1, deserializeDatum, Integer, List } from "@meshsdk/core";

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

type DepositDatum = ConStr1<[
    BuiltinByteString
]>;

type ProtocolParametersDatum = ConStr0<
    [
        Integer,
        Integer,
        Integer,
        Integer,
        List<BuiltinByteString>,
        Integer,
    ]
>;

// returns oracle rate and loan amount in tUSD
const calculateLoanAmount = (
    oracleAmount: Asset[] | undefined,
    paramsDatum: string | undefined,
    collateralAmmountInLovelaces: string,
): number[] => {
    if (!oracleAmount) {
        throw Error('Oracle Utxo invalid!');
    }
    if (!paramsDatum) {
        throw Error('Protocol Parameters Utxo invalid!');
    }
    const datum = deserializeDatum<ProtocolParametersDatum>(paramsDatum);
    const minCollateralRatio = Number(datum.fields[0].int);

    // In USD: USD * lovelaces / ada in lovelaces
    const oracleRate = ((Number(oracleAmount[1].quantity) * 1000000) / Number(oracleAmount[0].quantity))

    const hundredPercentCollateralValue = (Number(collateralAmmountInLovelaces) / minCollateralRatio) * 100

    // convert back to normal figures
    const eligibleLoanAmount = (hundredPercentCollateralValue * (oracleRate)) / 1000000;

    return [oracleRate, eligibleLoanAmount];
}

// returns oracle rate and loan amount in ADA
const calculateLoanAdaAmount = (
    oracleAmount: Asset[] | undefined,
    paramsDatum: string | undefined,
    loanAmount: string,
): number[] => {
    if (!oracleAmount) {
        throw Error('Oracle Utxo invalid!');
    }
    if (!paramsDatum) {
        throw Error('Protocol Parameters Utxo invalid!');
    }
    const datum = deserializeDatum<ProtocolParametersDatum>(paramsDatum);
    const minCollateralRatio = Number(datum.fields[0].int);

    // In USD: USD * lovelaces / ada in lovelaces
    const oracleUSDRate = ((Number(oracleAmount[1].quantity) * 1000000) / Number(oracleAmount[0].quantity))
    // In USD: ada in lovelaces / USD
    const oracleRate = (Number(oracleAmount[0].quantity) / Number(oracleAmount[1].quantity))

    // the 100% percent (equivalent) collateral value
    const collateralAmmountInLovelaces = Number(loanAmount) * oracleRate;

    // make the collateral value over collateralized using the minimum collateral ratio
    let overCollateralizedCollateralValue = collateralAmmountInLovelaces * (minCollateralRatio / 100);

    console.log("Raw overCollateralizedCollateralValue:", overCollateralizedCollateralValue);
    const overCollateralizedCollateralValueMod = (overCollateralizedCollateralValue / 1000000) % 1;
    // If the collateral amount (in ADA) has decimals
    if (overCollateralizedCollateralValueMod) {
        console.log("in mod?")
        overCollateralizedCollateralValue = Math.ceil(overCollateralizedCollateralValue);
        // Add 1000 lovelace (0.001 ADA) to cover for the gap
        overCollateralizedCollateralValue += 1000;
        console.log("overCollateralizedCollateralValue in if:", overCollateralizedCollateralValue);
    }
    console.log("overCollateralizedCollateralValue outside if:", overCollateralizedCollateralValue);

    return [oracleUSDRate, overCollateralizedCollateralValue];
}

export {
    calculateLoanAmount,
    calculateLoanAdaAmount,
    type CollateralDatum,
    type DepositDatum,
}
