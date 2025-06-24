import { applyParamsToScript, builtinByteString, outputReference, resolveScriptHash, serializePlutusScript } from "@meshsdk/core";
import { blueprint, wallet1VK } from "../setup.js";
import { CollateralValidatorHash } from "../CollateralValidator/validator.js";
import { UnifiedControlValidatorHash } from "../UnifiedControl/validator.js";

const LoanNftValidator = blueprint.validators.filter(v => 
    v.title.includes("unified_control_validator.unified_control_validator.spend")
);

// borrowUtxo: For ADA collaterals, it must be user's protocol balance (from collateral validator)
// For other assets, it must be a UTxO from the user's wallet
const borrowUtxo = outputReference("", 0);
const LoanNftValidatorScript = applyParamsToScript(
    LoanNftValidator[0].compiledCode,
    [
        borrowUtxo,
        builtinByteString(CollateralValidatorHash),
        builtinByteString(UnifiedControlValidatorHash),
    ],
    "JSON"
);

const LoanNftValidatorHash = resolveScriptHash(LoanNftValidatorScript, "V3");

const LoanNftValidatorAddr = serializePlutusScript(
    { code: LoanNftValidatorScript, version: "V3" },
).address;

console.log("LoanNftValidatorHash:", LoanNftValidatorHash);

export {
    LoanNftValidatorScript,
    LoanNftValidatorHash,
    LoanNftValidatorAddr,
}
