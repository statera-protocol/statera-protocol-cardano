import { applyParamsToScript, builtinByteString, conStr1, resolveScriptHash, serializePlutusScript } from "@meshsdk/core";
import { blueprint, wallet1VK } from "../setup.js";
import { CollateralValidatorHash } from "../CollateralValidator/validator.js";
import { BatchingValidatorHash } from "../Batching/validators.js";

const MintStValidator = blueprint.validators.filter(v => 
    v.title.includes("mint_st_validator.mint_st_validator.mint")
);

const MintStValidatorScript = applyParamsToScript(
    MintStValidator[0].compiledCode,
    [
        builtinByteString(CollateralValidatorHash),
        conStr1([builtinByteString(BatchingValidatorHash)])
    ],
    "JSON"
);

const MintStValidatorHash = resolveScriptHash(MintStValidatorScript, "V3");

const MintStValidatorAddr = serializePlutusScript(
    { code: MintStValidatorScript, version: "V3" },
).address;

console.log("MintStValidatorHash:", MintStValidatorHash);

export {
    MintStValidatorScript,
    MintStValidatorHash,
    MintStValidatorAddr,
}
