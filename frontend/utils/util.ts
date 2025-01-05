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

export {
    calculateLoanAmount,
    type CollateralDatum,
    type DepositDatum,
}
