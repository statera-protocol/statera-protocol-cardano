import { applyParamsToScript, builtinByteString, outputReference, resolveScriptHash, serializePlutusScript } from "@meshsdk/core";
import { assetObject, blueprint, wallet1Utxos, wallet1VK } from "../setup.js";
import { CollateralValidatorHash } from "../CollateralValidator/validator.js";
import { UnifiedControlValidatorHash } from "../UnifiedControl/validator.js";
import { getUserDepositUtxo } from "../utils.js";

const LoanNftValidator = blueprint.validators.filter(v => 
    v.title.includes("loan_nft_validator.loan_nft_validator.mint")
);

// borrowUtxo: For ADA collaterals, it must be user's protocol balance (from collateral validator)
// For other assets, it must be a UTxO from the user's wallet
const collateralAsset = assetObject.ada;
let borrowUtxo = undefined;
const userDepositUtxo = getUserDepositUtxo();

if (collateralAsset.policy == "") {
    borrowUtxo = outputReference(userDepositUtxo.input.txHash, userDepositUtxo.input.outputIndex);
    // console.log("is ada");
} else {
    borrowUtxo = outputReference(wallet1Utxos[0].input.txHash, wallet1Utxos[0].input.outputIndex);
}
// console.log("borrowUtxo:", borrowUtxo);

const LoanNftValidatorScript = applyParamsToScript(
    LoanNftValidator[0].compiledCode,
    [
        borrowUtxo,
        builtinByteString(CollateralValidatorHash),
        builtinByteString(UnifiedControlValidatorHash),
    ],
    "JSON"
);

const LoanNftPolicy = resolveScriptHash(LoanNftValidatorScript, "V3");

const LoanNftValidatorAddr = serializePlutusScript(
    { code: LoanNftValidatorScript, version: "V3" },
).address;

console.log("LoanNftValidatorHash:", LoanNftPolicy);

export {
    LoanNftValidator,
    LoanNftValidatorScript,
    LoanNftPolicy,
    LoanNftValidatorAddr,
}
