import { BuiltinByteString, ConStr0, deserializeDatum, Integer, List } from "@meshsdk/core";
import { blockchainProvider } from "../setup.js";
import { scriptAddr } from "./validator.js";

console.log('protocol paramters address', scriptAddr);

const protocolParameterUtxos = await blockchainProvider.fetchAddressUTxOs(scriptAddr);
console.log(protocolParameterUtxos, '\n');
const protocolParameterUtxo = protocolParameterUtxos[1];

// throw error for an invalid utxo
if (!protocolParameterUtxo) {
    throw new Error("No utxos to unlock");
}

// The datum type
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

// check for a datum in the utxo
if (!protocolParameterUtxo.output.plutusData) {
    throw new Error("No datum containing protocol parameters in utxo");
}

const datum = deserializeDatum<ProtocolParametersDatum>(protocolParameterUtxo.output.plutusData);

console.log('Protocol Parameters Datum:', datum, '\n');

const collateralAssets: string[] = [];
datum.fields[4].list.forEach(asset => collateralAssets.push(Buffer.from(asset.bytes, "hex").toString("utf8")));

console.log(`
    Protocol parameters:
        min_collateral_ratio: ${Number(datum.fields[0].int)}%,
        min_liquidation_amount: ${Number(datum.fields[1].int)}%,
        min_loan_amount: ${Number(datum.fields[2].int)},
        protocol_usage_fee: ${Number(datum.fields[3].int)},
        collateral_assets: ${collateralAssets.join(", ")},
`);
