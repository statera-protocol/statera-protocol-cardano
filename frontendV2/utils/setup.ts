import { NativeScript, resolveScriptHash, serializeNativeScript, stringToHex } from "@meshsdk/core";
import { applyParamsToScript, resolveNativeScriptHash } from "@meshsdk/core-csl";
import blueprint from "../../onchain/plutus.json" with { type: "json" };
import { AssetObject } from "./types";

export const setup = () => {
  // test mint
  // Always success mint validator
  const alwaysSuccessMintValidator = "585401010029800aba2aba1aab9eaab9dab9a4888896600264653001300600198031803800cc0180092225980099b8748000c01cdd500144c9289bae30093008375400516401830060013003375400d149a26cac8009";
  const alwaysSuccessValidatorMintScript = applyParamsToScript(
      alwaysSuccessMintValidator,
      [],
      "JSON",
  );
  const alwaysSuccessMintValidatorHash = resolveScriptHash(alwaysSuccessValidatorMintScript, "V3");

  // Constants
  const StPparamsAssetName = stringToHex("STP");
  const StStableAssetName = stringToHex("staterite");
  const StPoolNftName = stringToHex("SPN");
  const StOracleAssetName = stringToHex("STO");
  const StLiquidationAssetName = stringToHex("STL");
  const StPid = "e7e9f8f662083e491b9f9d234bf94ed9ff41afe78c7a1b24d994ba28"; // can change is smart contract changes

  // Reference scripts
  const collateralScriptTxHash = "a06509e429311b9940d3a685b91218755397de2510e297b0308427aa3edf8170";
  const collateralScriptIdx = 0;
  const mintStScriptTxHash = "9a92b88a1bfcd36cf24d653a3038693b40e27e74d0cc326634bf1dc06acfcccd";
  const mintStScriptTxIdx = 0;
  const batchingScriptTxHash = "5e353710d08f07044da43af8aa1d7e20cbb9f9b46e4b2d5ff60d9015f9414a21";
  const batchingScriptTxIdx = 0;

  const assetObject: AssetObject = {
      "ADA": {
          unit: stringToHex("lovelace"),
          policy: "",
          name: stringToHex("lovelace"),
      },
      "iUSD": {
          unit: alwaysSuccessMintValidatorHash + stringToHex("iUSD"),
          policy: alwaysSuccessMintValidatorHash,
          name: stringToHex("iUSD"),
      },
      "USDM": {
          unit: alwaysSuccessMintValidatorHash + stringToHex("USDM"),
          policy: alwaysSuccessMintValidatorHash,
          name: stringToHex("USDM"),
      },
      "hosky": {
          unit: alwaysSuccessMintValidatorHash + stringToHex("hosky"),
          policy: alwaysSuccessMintValidatorHash,
          name: stringToHex("hosky"),
      },
      "ST": {
          unit: StPid + StStableAssetName,
          policy: StPid,
          name: StStableAssetName,
      },
  }

  // Setup MultiSig
  const wallet1VK = "96cbb27c96daf8cab890de6d7f87f5ffd025bf8ac80717cbc4fae7da";
  const wallet2VK = "96cbb27c96daf8cab890de6d7f87f5ffd025bf8ac80717cbc4fae7da";

  const nativeScript: NativeScript = {
    type: "all",
    scripts: [
      {
          type: "sig",
          keyHash: wallet1VK,
      },
      {
          type: "sig",
          keyHash: wallet2VK,
      },
    ],
  };

  const { address: multiSigAddress, scriptCbor: multiSigCbor } = serializeNativeScript(nativeScript);
  const multiSigHash = resolveNativeScriptHash(nativeScript);

  return {
    blueprint,
    alwaysSuccessValidatorMintScript,
    alwaysSuccessMintValidatorHash,
    StPparamsAssetName,
    StStableAssetName,
    StPoolNftName,
    StOracleAssetName,
    StLiquidationAssetName,
    collateralScriptTxHash,
    collateralScriptIdx,
    mintStScriptTxHash,
    mintStScriptTxIdx,
    batchingScriptTxHash,
    batchingScriptTxIdx,
    assetObject,
    multiSigHash,
    multiSigAddress,
  };
}
