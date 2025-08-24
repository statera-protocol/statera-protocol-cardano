import { BuiltinByteString, ConStr0, ConStr1, Integer, List, MaestroProvider, mConStr0, PubKeyAddress } from "@meshsdk/core";

// Blockchain provider
export type BlockchainProviderType = MaestroProvider;

// Order Type
export type OrderType = ConStr0 | ConStr1;

// Asset Type
export type AssetType = ConStr0<[
    ConStr0 | ConStr1,
    BuiltinByteString,
    BuiltinByteString,
]>;

// Order Datum
export type OrderDatumType = ConStr0<[
    OrderType,
    PubKeyAddress,
    BuiltinByteString,
    AssetType,
]>;

// Deposit/Balance Datum
export type DepositDatum = ConStr1<[
    BuiltinByteString,
]>;

// Asset Rate
export type AssetRate = ConStr0<[
    BuiltinByteString,
    Integer,
    Integer,
]>;

// Oracle Datum
export type OracleDatum = ConStr0<[
    List<AssetRate>,
]>;

// Protocol Parameters Datum
export type ProtocolParametersDatum = ConStr1<
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
export type CollateralDatum = ConStr0<[
    BuiltinByteString,
    BuiltinByteString,
    Integer,
    BuiltinByteString,
    BuiltinByteString,
    Integer,
    AssetType,
    Integer,
]>;

// Asset Object
export interface AssetDetails {
    unit: string;
    policy: string;
    name: string;
};
export interface AssetObject {
    [symbol: string]: AssetDetails;
};
