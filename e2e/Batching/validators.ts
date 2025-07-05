import { applyParamsToScript, builtinByteString, conStr1, resolveScriptHash, serializePlutusScript, serializeRewardAddress } from "@meshsdk/core";
import { assetObject, blockchainProvider, blueprint, wallet1VK } from "../setup.js";
import { UnifiedControlValidatorHash } from "../UnifiedControl/validator.js";

// Pool
const PoolValidator = blueprint.validators.filter(v => 
    v.title.includes("pool_validators.pool_validator.spend")
);

const PoolValidatorScript = applyParamsToScript(
    PoolValidator[0].compiledCode,
    [builtinByteString(UnifiedControlValidatorHash)],
    "JSON"
);

const PoolValidatorHash = resolveScriptHash(PoolValidatorScript, "V3");

const PoolValidatorAddr = serializePlutusScript(
    { code: PoolValidatorScript, version: "V3" },
).address;

console.log("PoolValidatorHash:", PoolValidatorHash);

// Pool Batching
const BatchingValidator = blueprint.validators.filter(v => 
    v.title.includes("pool_validators.pool_batching_validator.withdraw")
);

const BatchingValidatorScript = applyParamsToScript(
    BatchingValidator[0].compiledCode,
    [
        builtinByteString(UnifiedControlValidatorHash),
        builtinByteString(PoolValidatorHash),
    ],
    "JSON"
);

const BatchingValidatorHash = resolveScriptHash(BatchingValidatorScript, "V3");

// const BatchingValidatorAddr = serializePlutusScript(
//     { code: BatchingValidatorScript, version: "V3" },
// ).address;

const BatchingRewardAddr = serializeRewardAddress(
    BatchingValidatorHash,
    true,
    0
);

console.log("BatchingValidatorHash:", BatchingValidatorHash);

// Order
const OrderValidator = blueprint.validators.filter(v => 
    v.title.includes("pool_validators.order_validator.spend")
);

const OrderValidatorScript = applyParamsToScript(
    OrderValidator[0].compiledCode,
    [conStr1([builtinByteString(BatchingValidatorHash)])],
    "JSON"
);

const OrderValidatorHash = resolveScriptHash(OrderValidatorScript, "V3");

const OrderValidatorAddr = serializePlutusScript(
    { code: OrderValidatorScript, version: "V3" },
    OrderValidatorHash,
    0,
    true,
).address;

const OrderValidatorRewardAddr = serializeRewardAddress(
    OrderValidatorHash,
    true,
    0
);

console.log("OrderValidatorHash:", OrderValidatorHash);

const batchingAsset = assetObject.USDM;


// const poolUtxos = await blockchainProvider.fetchAddressUTxOs(PoolValidatorAddr);
// console.log(poolUtxos[0].output.amount);
// const orderUtxos = await blockchainProvider.fetchAddressUTxOs(OrderValidatorAddr);
// console.log("orderUtxos:", orderUtxos);

export {
    PoolValidatorScript,
    PoolValidatorHash,
    PoolValidatorAddr,
    BatchingValidatorScript,
    BatchingValidatorHash,
    BatchingRewardAddr,
    OrderValidatorScript,
    OrderValidatorHash,
    OrderValidatorAddr,
    OrderValidatorRewardAddr,
    batchingAsset,
}
