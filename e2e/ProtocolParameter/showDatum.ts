import { BuiltinByteString, ConStr0, deserializeDatum, Integer, List } from "@meshsdk/core";
import { blockchainProvider, scriptAddr } from "./setup.js";

const lockedUTxosWithDatum = await blockchainProvider.fetchAddressUTxOs(scriptAddr);
console.log(lockedUTxosWithDatum, '\n');
const lockedUTxoWithDatum = lockedUTxosWithDatum[0];

// throw error for an invalid utxo
if (!lockedUTxoWithDatum) {
    throw new Error("No utxos to unlock");
}

// The datum type
type ProtocolParametersDatum = ConStr0<
    [
        Integer,
        Integer,
        Integer,
        List<BuiltinByteString>,
        Integer,
    ]
>;

// check for a datum in the utxo
if (!lockedUTxoWithDatum.output.plutusData) {
    throw new Error("No datum containing protocol parameters in utxo");
}

const datum = deserializeDatum<ProtocolParametersDatum>(lockedUTxoWithDatum.output.plutusData);

console.log('Protocol Parameters Datum:', datum, '\n');

const collateralAssets: string[] = [];
datum.fields[3].list.forEach(asset => collateralAssets.push(Buffer.from(asset.bytes, "hex").toString("utf8")));

console.log(`
    Protocol Parameters Reconstructed keeping in mind that all ints (excluding loan term) were multiplied by 10_000
    Protocol parameters:
        min_collateral_ratio: ${Number(datum.fields[0].int) / 10000},
        min_loan_amount: ${Number(datum.fields[1].int) / 10000},
        protocol_usage_fee: ${Number(datum.fields[2].int) / 10000},
        collateral_assets: ${collateralAssets.join(", ")},
        loan_term: ${datum.fields[4].int} milli seconds,
`);
