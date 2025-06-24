import { ConStr0, deserializeDatum, mConStr0, mConStr1, mConStr3, stringToHex } from "@meshsdk/core";
import { alwaysSuccessMintValidatorHash, blockchainProvider, pParamsUtxo, StPoolNftName, StStableAssetName, txBuilder, usdmUnit, wallet1, wallet1Address, wallet1Collateral, wallet1Utxos } from "../setup.js";
import { MintStValidatorHash, MintStValidatorScript } from "../StMinting/validator.js";
import { BatchingRewardAddr, BatchingValidatorHash, BatchingValidatorScript, OrderValidatorAddr, OrderValidatorRewardAddr, OrderValidatorScript, PoolValidatorAddr, PoolValidatorHash, PoolValidatorScript } from "./validators.js";
import { OrderDatumType } from "../types.js";

const poolAssetUnit = usdmUnit;

const AllOrderUtxos = await blockchainProvider.fetchAddressUTxOs(OrderValidatorAddr);
// Only orders with the pool asset and with a valid datum are batched
const batchingOrderUtxos = AllOrderUtxos.filter((utxo) => {
    const orderPoolAsset = utxo.output.amount.find(ast => ast.unit == poolAssetUnit);
    const datum = utxo.output.plutusData;

    // order must contain pool asset and must have a datum
    if (!orderPoolAsset || !datum) {
        return false
    }
    const orderDatum = deserializeDatum<OrderDatumType>(datum);

    // For now, datum validation is the data should be 3 lengths
    return orderDatum.fields.length == 3;
});
// console.log("batchingOrderUtxos:", batchingOrderUtxos);

const poolUtxo = (await blockchainProvider.fetchAddressUTxOs(PoolValidatorAddr))[0];

const batchingScriptTxHash = "f055116712adf9c3511ded5f4598e8d642deb960ef4ea9f84efe583b02e83ba2";
const batchingScriptTxIndex = 0;

const stMinted = 10000000;
const poolUtxoBalance = (() => {
    const poolAsset = poolUtxo.output.amount.find(ast => ast.unit == poolAssetUnit);
    if (!poolAsset) {
        throw new Error("pool asset not found!");
    }
    return poolAsset.quantity;
})();
const poolOutChange = Number(poolUtxoBalance) + stMinted;
// console.log("poolOutChange:", poolOutChange);

const PoolDatum = mConStr0([
    mConStr1([BatchingValidatorHash])
]);

const PoolBatchingRedeemer = mConStr0([
    0,
    mConStr0([
        mConStr1([]),
        alwaysSuccessMintValidatorHash,
        stringToHex("usdm"),
    ])
]);

// let orderTxs = txBuilder;
// for (let i = 0; i < batchingOrderUtxos.length; i++) {
//     orderTxs = orderTxs
//         .spendingPlutusScriptV3()
//         .txIn(
//             batchingOrderUtxos[i].input.txHash,
//             batchingOrderUtxos[i].input.outputIndex,
//             batchingOrderUtxos[i].output.amount,
//             batchingOrderUtxos[i].output.address,
//         )
//         .txInScript(OrderValidatorScript)
//         .spendingReferenceTxInInlineDatumPresent()
//         .spendingReferenceTxInRedeemerValue("")
// };

const unsignedTx = await txBuilder
    // mint st tokens
    .mintPlutusScriptV3()
    .mint(String(stMinted), MintStValidatorHash, StStableAssetName)
    .mintingScript(MintStValidatorScript)
    .mintRedeemerValue(mConStr3([]))
    // order spend
    .spendingPlutusScriptV3()
    .txIn(
        batchingOrderUtxos[0].input.txHash,
        batchingOrderUtxos[0].input.outputIndex,
        batchingOrderUtxos[0].output.amount,
        batchingOrderUtxos[0].output.address,
    )
    .txInScript(OrderValidatorScript)
    .spendingReferenceTxInInlineDatumPresent()
    .spendingReferenceTxInRedeemerValue("")
    // order withdrawal (Process Order)
    .withdrawalPlutusScriptV3()
    .withdrawal(OrderValidatorRewardAddr, "0")
    .withdrawalScript(OrderValidatorScript)
    .withdrawalRedeemerValue(mConStr1([]))
    // spend pool utxo
    .spendingPlutusScriptV3()
    .txIn(
        poolUtxo.input.txHash,
        poolUtxo.input.outputIndex,
        poolUtxo.output.amount,
        poolUtxo.output.address,
    )
    .txInScript(PoolValidatorScript)
    .spendingReferenceTxInInlineDatumPresent()
    .spendingReferenceTxInRedeemerValue("")
    // batching
    .withdrawalPlutusScriptV3()
    .withdrawal(BatchingRewardAddr, "0")
    .withdrawalTxInReference(batchingScriptTxHash, batchingScriptTxIndex, undefined, BatchingValidatorHash)
    .withdrawalRedeemerValue(PoolBatchingRedeemer)
    // pool output utxo
    .txOut(PoolValidatorAddr, [
        { unit: poolAssetUnit, quantity: String(poolOutChange) },
        { unit: PoolValidatorHash + StPoolNftName, quantity: "1" }
    ])
    .txOutInlineDatumValue(PoolDatum)
    // order output
    .txOut(wallet1Address, [ poolUtxo.output.amount[0], { unit: MintStValidatorHash + StStableAssetName, quantity: String(stMinted) }])
    // protocol parameters reference input
    .readOnlyTxInReference(pParamsUtxo.input.txHash, pParamsUtxo.input.outputIndex)
    .txInCollateral(
        wallet1Collateral.input.txHash,
        wallet1Collateral.input.outputIndex,
        wallet1Collateral.output.amount,
        wallet1Collateral.output.address,
    )
    .changeAddress(wallet1Address)
    .selectUtxosFrom(wallet1Utxos)
    // .setFee("1130441")
    .complete()

const signedTx = await wallet1.signTx(unsignedTx);

const txHash = await wallet1.submitTx(signedTx);
console.log("Pool batching:", txHash);
