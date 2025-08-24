import { applyParamsToScript, builtinByteString, conStr1, mConStr0, mConStr1, resolveScriptHash, serializePlutusScript } from "@meshsdk/core";
import { blueprint, StStableAssetName, wallet1VK } from "../setup.js";
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

const MintStPolicy = resolveScriptHash(MintStValidatorScript, "V3");

const MintStValidatorAddr = serializePlutusScript(
    { code: MintStValidatorScript, version: "V3" },
).address;

const stUnit = MintStPolicy + StStableAssetName;

const st_asset = mConStr0([
    mConStr1([]),
    MintStPolicy,
    StStableAssetName,
]);

console.log("MintStValidatorHash:", MintStPolicy);

export {
    MintStValidatorScript,
    MintStPolicy,
    MintStValidatorAddr,
    stUnit,
    st_asset,
}
