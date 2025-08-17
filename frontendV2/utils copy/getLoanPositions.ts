import { deserializeDatum, IWallet, MaestroProvider, UTxO } from "@meshsdk/core";
import { CollateralDatum } from "./util";

export const getLoanPositions = async (
    blockchainProvider: MaestroProvider,
    collateralValidatorAddress: string,
    walletUtxos: UTxO[],
) => {
    const collateralUtxos = await blockchainProvider.fetchAddressUTxOs(collateralValidatorAddress);

    const userCollateralUtxos = collateralUtxos.filter(utxo => {
        const datumData = utxo.output.plutusData
        if (!datumData) {
            return false;
        }

        const datum = deserializeDatum<CollateralDatum>(datumData);
        if (datum.fields.length < 5 || !Object.hasOwn(datum.fields[4], "bytes")) {
            return false;
        }
        const loanNftPolicyId = datum.fields[4].bytes;

        // check each wallet utxo for the presence of loan NFT(s) and return the corresponding collateral utxo(s)
        for (let i = 0; i < walletUtxos.length; i++) {
            let walletUtxo = walletUtxos[i];
            const walletUtxoAmountUnits = walletUtxo.output.amount.map((amount) => amount.unit);

            for (let i = 0; i < walletUtxoAmountUnits.length; i++) {
                if (walletUtxoAmountUnits[i].slice(0, 56) == loanNftPolicyId) {
                    return true;
                }
            }
        }
    });

    console.log("userCollateralUtxos:", userCollateralUtxos);
    return userCollateralUtxos;
}

export const getLoanPositionDetails = (loanPosition: UTxO) => {
    const datumData = loanPosition.output.plutusData
    if (!datumData) {
        return false;
    }

    const datum = deserializeDatum<CollateralDatum>(datumData);
    if (datum.fields.length < 8 || !Object.hasOwn(datum.fields[4], "bytes")) {
        return false;
    }

    return {
        tusd_pool_hash: datum.fields[0].bytes,
        tusd_policy_id: datum.fields[1].bytes,
        tusd_asset_name: datum.fields[2].bytes,
        tusd_borrowed: datum.fields[3].int,
        loan_nft_pid: datum.fields[4].bytes,
        loan_nft_asset_name: datum.fields[5].bytes,
        collateral_rate_in_lovelace: datum.fields[6].int,
        collateral_asset: datum.fields[7].bytes,
        collateral_amount_in_lovelace: datum.fields[8].int,
    }
}
