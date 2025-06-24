import { applyParamsToScript, builtinByteString, conStr1, resolveScriptHash, serializePlutusScript } from "@meshsdk/core";
import { blueprint, wallet1VK } from "../setup.js";
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
const PoolBatchingValidator = blueprint.validators.filter(v => 
    v.title.includes("pool_validators.pool_batching_validator.withdraw")
);

const PoolBatchingValidatorScript = applyParamsToScript(
    PoolBatchingValidator[0].compiledCode,
    [
        builtinByteString(UnifiedControlValidatorHash),
        builtinByteString(PoolValidatorHash),
    ],
    "JSON"
);

const PoolBatchingValidatorHash = resolveScriptHash(PoolBatchingValidatorScript, "V3");

const PoolBatchingValidatorAddr = serializePlutusScript(
    { code: PoolBatchingValidatorScript, version: "V3" },
).address;

console.log("PoolBatchingValidatorHash:", PoolBatchingValidatorHash);

// Order
const OrderValidator = blueprint.validators.filter(v => 
    v.title.includes("pool_validators.order_validator.spend")
);

const OrderValidatorScript = applyParamsToScript(
    OrderValidator[0].compiledCode,
    [conStr1([builtinByteString(PoolBatchingValidatorHash)])],
    "JSON"
);

const OrderValidatorHash = resolveScriptHash(OrderValidatorScript, "V3");

const OrderValidatorAddr = serializePlutusScript(
    { code: OrderValidatorScript, version: "V3" },
).address;

console.log("OrderValidatorHash:", OrderValidatorHash);

export {
    PoolValidatorScript,
    PoolValidatorHash,
    PoolValidatorAddr,
    PoolBatchingValidatorScript,
    PoolBatchingValidatorHash,
    PoolBatchingValidatorAddr,
    OrderValidatorScript,
    OrderValidatorHash,
    OrderValidatorAddr,
}
