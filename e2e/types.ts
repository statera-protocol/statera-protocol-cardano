import { BuiltinByteString, ConStr0, ConStr1, Integer, List, mConStr0, PubKeyAddress } from "@meshsdk/core";

// Order Type
type OrderType = ConStr0 | ConStr1;

// Asset Type
type AssetType = ConStr0<[
    ConStr0 | ConStr1,
    BuiltinByteString,
    BuiltinByteString,
]>;

// Order Datum
type OrderDatumType = ConStr0<[
    OrderType,
    PubKeyAddress,
    BuiltinByteString,
    AssetType,
]>;

// Deposit/Balance Datum
type DepositDatum = ConStr1<[
    BuiltinByteString,
]>;

// Asset Rate
type AssetRate = ConStr0<[
    BuiltinByteString,
    Integer,
    Integer,
]>;

// Oracle Datum
type OracleDatum = ConStr0<[
    List<AssetRate>,
]>;

// Protocol Parameters Datum
type ProtocolParametersDatum = ConStr1<
    [
        Integer,
        Integer,
        Integer,
        Integer,
        Integer,
        AssetType,
        List<AssetType>,
        List<AssetType>,
        List<BuiltinByteString>,
        BuiltinByteString,
    ]
>;

// Collateral Datum
type CollateralDatum = ConStr0<[
    BuiltinByteString,
    BuiltinByteString,
    Integer,
    BuiltinByteString,
    BuiltinByteString,
    Integer,
    AssetType,
    Integer,
]>;

export {
    OrderDatumType,
    DepositDatum,
    OracleDatum,
    ProtocolParametersDatum,
    CollateralDatum,
}
