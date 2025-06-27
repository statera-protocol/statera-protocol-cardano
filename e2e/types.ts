import { BuiltinByteString, ConStr0, ConStr1, PubKeyAddress } from "@meshsdk/core";

type OrderType = ConStr0 | ConStr1;
type AssetType = ConStr0<[
    ConStr0 | ConStr1,
    BuiltinByteString,
    BuiltinByteString,
]>;
type OrderDatumType = ConStr0<[
    OrderType,
    PubKeyAddress,
    BuiltinByteString,
]>;

export {
    OrderDatumType,
}
