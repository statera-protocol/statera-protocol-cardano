import { applyParamsToScript, builtinByteString, resolveScriptHash, serializePlutusScript } from "@meshsdk/core";
import { setup } from "../setup";

const { blueprint, multiSigHash } = setup();

const UnifiedControlValidator = blueprint.validators.filter(v => 
    v.title.includes("unified_control_validator.unified_control_validator.spend")
);

const UnifiedControlValidatorScript = applyParamsToScript(
    UnifiedControlValidator[0].compiledCode,
    [builtinByteString(multiSigHash)],
    "JSON"
);

const UnifiedControlValidatorHash = resolveScriptHash(UnifiedControlValidatorScript, "V3");

const UnifiedControlValidatorAddr = serializePlutusScript(
    { code: UnifiedControlValidatorScript, version: "V3" },
).address;

// console.log("UnifiedControlValidatorHash:", UnifiedControlValidatorHash);

export {
    UnifiedControlValidatorScript,
    UnifiedControlValidatorHash,
    UnifiedControlValidatorAddr,
}
