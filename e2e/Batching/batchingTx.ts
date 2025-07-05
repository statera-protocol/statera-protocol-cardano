import { ConStr0, deserializeDatum, mConStr0, mConStr1, mConStr3, stringToHex } from "@meshsdk/core";
import { blockchainProvider, StPoolNftName, StStableAssetName, txBuilder, wallet1, wallet1Address, wallet1Collateral, wallet1Utxos, wallet1VK, wallet2Address } from "../setup.js";
import { MintStPolicy, MintStValidatorScript, stUnit } from "../StMinting/validator.js";
import { batchingAsset, BatchingRewardAddr, BatchingValidatorHash, BatchingValidatorScript, OrderValidatorAddr, OrderValidatorHash, OrderValidatorRewardAddr, OrderValidatorScript, PoolValidatorAddr, PoolValidatorHash, PoolValidatorScript } from "./validators.js";
import { OrderDatumType } from "../types.js";
import { pParamsUtxo } from "../utils.js";

const poolAssetUnit = batchingAsset.unit;

const AllOrderUtxos = await blockchainProvider.fetchAddressUTxOs(OrderValidatorAddr);
// Only orders with the pool asset and with a valid datum are batched
const batchingOrderUtxos = AllOrderUtxos;
// const batchingOrderUtxos = AllOrderUtxos.filter((utxo) => {
//     const orderPoolAsset = utxo.output.amount.find(ast => ast.unit == poolAssetUnit);
//     const datum = utxo.output.plutusData;

//     // order must contain pool asset and must have a datum
//     if (!orderPoolAsset || !datum) {
//         return false
//     }
//     const orderDatum = deserializeDatum<OrderDatumType>(datum);

//     // For now, datum validation is the data should be 3 lengths
//     return orderDatum.fields.length == 3;
// });
// console.log("batchingOrderUtxos:", batchingOrderUtxos);

const poolUtxo = (await blockchainProvider.fetchAddressUTxOs(PoolValidatorAddr))[0];

const batchingScriptTxHash = "bc85cb10c929dc6770112200d73c70bae6a50701098c815eb25aa0f657942b4c";
const batchingScriptTxIndex = 0;
const orderScriptTxHash = "";
const orderScriptTxIndex = 0;

const stMinted = 18000000;
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
        batchingAsset.policy,
        batchingAsset.name,
    ]),
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
    .mint(String(stMinted), MintStPolicy, StStableAssetName)
    .mintingScript(MintStValidatorScript)
    .mintRedeemerValue(mConStr3([]))
    // order spend 0
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
    // order spend 1
    .spendingPlutusScriptV3()
    .txIn(
        batchingOrderUtxos[1].input.txHash,
        batchingOrderUtxos[1].input.outputIndex,
        batchingOrderUtxos[1].output.amount,
        batchingOrderUtxos[1].output.address,
    )
    .txInScript(OrderValidatorScript)
    .spendingReferenceTxInInlineDatumPresent()
    .spendingReferenceTxInRedeemerValue("")
    // order spend 2
    .spendingPlutusScriptV3()
    .txIn(
        batchingOrderUtxos[2].input.txHash,
        batchingOrderUtxos[2].input.outputIndex,
        batchingOrderUtxos[2].output.amount,
        batchingOrderUtxos[2].output.address,
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
    // order output 0
    .txOut(wallet1Address, [
        batchingOrderUtxos[0].output.amount[0], poolUtxo.output.amount[0],
        { unit: stUnit, quantity: String(10000000) }
    ])
    // order output 1
    .txOut(wallet1Address, [
        batchingOrderUtxos[1].output.amount[0], poolUtxo.output.amount[0],
        { unit: poolAssetUnit, quantity: String(7000000) }
    ])
    // order output 2
    .txOut(wallet1Address, [
        batchingOrderUtxos[2].output.amount[0], poolUtxo.output.amount[0],
        { unit: stUnit, quantity: String(15000000) }
    ])
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
    .setFee("5101297")
    .complete()

const signedTx = await wallet1.signTx(unsignedTx);

const txHash = await wallet1.submitTx(signedTx);
console.log("Pool batching:", txHash);
