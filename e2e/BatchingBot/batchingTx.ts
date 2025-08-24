import { deserializeDatum, mConStr0, mConStr1, mConStr3, serializeAddressObj } from "@meshsdk/core";
import { assetObject, batchingScriptTxHash, batchingScriptTxIdx, blockchainProvider, StPoolNftName, StStableAssetName, txBuilder, wallet1, wallet1Address, wallet1Collateral, wallet1Utxos, wallet1VK } from "../setup.js";
import { MintStPolicy, MintStValidatorScript, stUnit } from "../StMinting/validator.js";
import { BatchingRewardAddr, BatchingValidatorHash, OrderValidatorAddr, OrderValidatorRewardAddr, OrderValidatorScript, PoolValidatorAddr, PoolValidatorHash, PoolValidatorScript } from "../Batching/validators.js";
import { OrderDatumType } from "../types.js";
import { getPParamsUtxo } from "../utils.js";

// Change this to batch different assets
const batchingAsset = assetObject.USDM;

// Change this too to either true or false for the stablenesss
const isStable = true;
let batchingAssetStableness = undefined;
if (isStable) {
  batchingAssetStableness = mConStr1([]);
} else {
  batchingAssetStableness = mConStr0([]);
}

const pParamsUtxo = getPParamsUtxo();

const correctOrderAsset =
    mConStr0([
        batchingAssetStableness,
        batchingAsset.policy,
        batchingAsset.name,
    ]);

const AllOrderUtxos = await blockchainProvider.fetchAddressUTxOs(OrderValidatorAddr);
// Only orders with the pool asset and with a valid datum are batched
const AllBatchingOrderUtxos = AllOrderUtxos.filter((utxo) => {
    const datum = utxo.output.plutusData;
    // order utxo must have a datum
    if (!datum) return false

    const orderDatum = deserializeDatum<OrderDatumType>(datum);
    const orderAsset =
        mConStr0([
            batchingAssetStableness,
            orderDatum.fields[3].fields[1].bytes,
            orderDatum.fields[3].fields[2].bytes,
        ]);

    // order datum should be of the correct length and the right asset
    return orderDatum.fields.length == 4 && (
        JSON.stringify(orderAsset) == JSON.stringify(correctOrderAsset)
    );
});

// Select only 10 utxos to batch
const batchingOrderUtxos = AllBatchingOrderUtxos.slice(0, 10);
// console.log("batchingOrderUtxos:", batchingOrderUtxos);

const poolUtxos = await blockchainProvider.fetchAddressUTxOs(PoolValidatorAddr);
// Find the right pool utxo
const poolUtxo = poolUtxos.find(utxo => utxo.output.amount.find(ast => ast.unit == batchingAsset.unit))
if (!poolUtxo) throw new Error("The right pool utxo not found!");
// console.log("poolUtxo:", poolUtxo);

let stMinted = 0;
let orderTxs = txBuilder

for (let i = 0; i < batchingOrderUtxos.length; i++) {
    const orderStAsset = batchingOrderUtxos[i].output.amount.find(ast => ast.unit == stUnit);
    const orderAsset = batchingOrderUtxos[i].output.amount.find(ast => ast.unit == batchingAsset.unit);

    const orderStAssetAmount = (orderStAsset?.quantity || 0);
    const orderAssetAmount = (orderAsset?.quantity || 0);

    stMinted += Number(orderAssetAmount);
    stMinted -= Number(orderStAssetAmount);

    orderTxs = orderTxs
        .spendingPlutusScriptV3()
        .txIn(
            batchingOrderUtxos[i].input.txHash,
            batchingOrderUtxos[i].input.outputIndex,
            batchingOrderUtxos[i].output.amount,
            batchingOrderUtxos[i].output.address,
        )
        .txInScript(OrderValidatorScript)
        .spendingReferenceTxInInlineDatumPresent()
        .spendingReferenceTxInRedeemerValue("")
}

const poolUtxoBalance = (() => {
    const poolAsset = poolUtxo.output.amount.find(ast => ast.unit == batchingAsset.unit);
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
    correctOrderAsset,
]);

orderTxs = orderTxs
    // order withdrawal (Process Order)
    .withdrawalPlutusScriptV3()
    .withdrawal(OrderValidatorRewardAddr, "0")
    .withdrawalScript(OrderValidatorScript)
    .withdrawalRedeemerValue(mConStr1([]))
    // mint st tokens
    .mintPlutusScriptV3()
    .mint(String(stMinted), MintStPolicy, StStableAssetName)
    .mintingScript(MintStValidatorScript)
    .mintRedeemerValue(mConStr3([]))
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
    .withdrawalTxInReference(batchingScriptTxHash, batchingScriptTxIdx, undefined, BatchingValidatorHash)
    .withdrawalRedeemerValue(PoolBatchingRedeemer)
    // pool output utxo
    .txOut(PoolValidatorAddr, [
        { unit: batchingAsset.unit, quantity: String(poolOutChange) },
        { unit: PoolValidatorHash + StPoolNftName, quantity: "1" }
    ])
    .txOutInlineDatumValue(PoolDatum)

for (let i = 0; i < batchingOrderUtxos.length; i++) {
    const orderUtxo = batchingOrderUtxos[i];
    const datum = orderUtxo.output.plutusData;
    if (!datum) throw new Error("Order utxo must have a datum");

    const orderDatum = deserializeDatum<OrderDatumType>(datum);
    const orderAddress = serializeAddressObj(orderDatum.fields[1]);

    const orderStAsset = batchingOrderUtxos[i].output.amount.find(ast => ast.unit == stUnit);
    const orderAsset = batchingOrderUtxos[i].output.amount.find(ast => ast.unit == batchingAsset.unit);

    // filter out the asset to be exchanged from the order value
    const orderUtxoChange = orderUtxo.output.amount.filter(ast => {
        if (orderStAsset) {
            return ast !== orderStAsset;
        } else if (orderAsset) {
            return ast !== orderAsset;
        }
        return true;
    });

    let orderResultAmount = undefined;

    if (orderStAsset) {
        orderResultAmount = { unit: batchingAsset.unit, quantity: orderStAsset.quantity }
    } else if (orderAsset) {
        orderResultAmount = { unit: (MintStPolicy + StStableAssetName), quantity: orderAsset.quantity }
    }

    if (!orderResultAmount) throw new Error("No result for order!");

    orderTxs = orderTxs
        .txOut(orderAddress, [
        // batchingOrderUtxos[i].output.amount[0], poolUtxo.output.amount[0],
        ...orderUtxoChange,
        orderResultAmount,
    ])
}

const unsignedTx = await orderTxs
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
    .requiredSignerHash(wallet1VK)
    // .setFee("5101297")
    .complete()

const signedTx = await wallet1.signTx(unsignedTx);

const txHash = await wallet1.submitTx(signedTx);
console.log("Pool batching:", txHash);
