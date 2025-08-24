import { applyParamsToScript, builtinByteString, outputReference, resolveScriptHash, serializePlutusScript, UTxO } from "@meshsdk/core";
import { setup } from "../setup";
import { CollateralValidatorHash } from "../CollateralValidator/validator";
import { UnifiedControlValidatorHash } from "../UnifiedControl/validator";
import { getUserDepositUtxo } from "../utils";
import { AssetDetails } from "../types";

export const LoanNftValidatorExports = async (
    walletVK: string,
    walletUtxos: UTxO[],
    collateralAsset: AssetDetails,
) => {
    const { assetObject, blueprint } = setup();

    const LoanNftValidator = blueprint.validators.filter(v => 
        v.title.includes("loan_nft_validator.loan_nft_validator.mint")
    );

    // borrowUtxo: For ADA collaterals, it must be user's protocol balance (from collateral validator)
    // For other assets, it must be a UTxO from the user's wallet
    let borrowUtxo = undefined;
    const userDepositUtxo = await getUserDepositUtxo(walletVK);

    if (collateralAsset.policy == "") {
        borrowUtxo = outputReference(userDepositUtxo.input.txHash, userDepositUtxo.input.outputIndex);
        // console.log("is ada");
    } else {
        borrowUtxo = outputReference(walletUtxos[0].input.txHash, walletUtxos[0].input.outputIndex);
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

    return {
        LoanNftValidator,
        LoanNftValidatorScript,
        LoanNftPolicy,
        LoanNftValidatorAddr,
    }
}
