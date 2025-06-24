import { BuiltinByteString, ConStr0, ConStr1, PubKeyAddress } from "@meshsdk/core";

type OrderType = ConStr0 | ConStr1;
type OrderDatumType = ConStr0<[
    OrderType,
    PubKeyAddress,
    BuiltinByteString,
]>;

export {
    OrderDatumType,
}
