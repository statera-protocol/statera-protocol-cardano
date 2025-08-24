import { applyParamsToScript, builtinByteString, deserializeDatum, resolveScriptHash, serializePlutusScript, stringToHex } from "@meshsdk/core";
import { blueprint } from "../setup.js";
import { UnifiedControlValidatorHash } from "../UnifiedControl/validator.js";

const CollateralValidator = blueprint.validators.filter(v => 
    v.title.includes("collateral_validator.collateral_validator.spend")
);

const CollateralValidatorScript = applyParamsToScript(
    CollateralValidator[0].compiledCode,
    [builtinByteString(UnifiedControlValidatorHash)],
    "JSON"
);

const CollateralValidatorHash = resolveScriptHash(CollateralValidatorScript, "V3");

const CollateralValidatorAddr = serializePlutusScript(
    { code: CollateralValidatorScript, version: "V3" },
).address;

console.log("CollateralValidatorHash:", CollateralValidatorHash);

const receiptTokenName = "st-receipt";
const receiptTokenNameHex = stringToHex(receiptTokenName);
const receiptTokenUnit = CollateralValidatorHash +  receiptTokenNameHex;

const identifierTokenName = "st-identifier";
const identifierTokenNameHex = stringToHex(identifierTokenName);
const identifierTokenUnit = CollateralValidatorHash +  identifierTokenNameHex;

export {
    CollateralValidatorScript,
    CollateralValidatorHash,
    CollateralValidatorAddr,
    receiptTokenNameHex,
    receiptTokenUnit,
    identifierTokenNameHex,
    identifierTokenUnit,
}
