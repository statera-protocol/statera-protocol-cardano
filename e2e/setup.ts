import {
    BlockfrostProvider,
    MaestroProvider,
    MeshTxBuilder,
    MeshWallet,
    deserializeAddress,
    resolveScriptHash,
    serializeNativeScript,
} from "@meshsdk/core";
import { NativeScript, stringToHex, UTxO } from "@meshsdk/common";
import dotenv from "dotenv";
dotenv.config();
import blueprint from "../onchain/plutus.json" with { type: "json" };
import { applyParamsToScript, OfflineEvaluator, resolveNativeScriptHash } from "@meshsdk/core-csl";

// Setup blockhain provider as Maestro
const maestroKey = process.env.MAESTRO_KEY;
if (!maestroKey) {
    throw new Error("MAESTRO_KEY does not exist");
}
const blockchainProvider = new MaestroProvider({
    network: 'Preprod',
    apiKey: maestroKey,
});

// Setup blockhain provider as Blockfrost
// const blockfrostId = process.env.BLOCKFROST_ID;
// if (!blockfrostId) {
//     throw new Error("BLOCKFROST_ID does not exist");
// }
// const blockchainProvider = new BlockfrostProvider(blockfrostId);

// import admin's wallet passphrase and initialize the wallet
const wallet1Passphrase = process.env.WALLET_PASSPHRASE_ONE;
if (!wallet1Passphrase) {
    throw new Error("WALLET_PASSPHRASE_ONE does not exist");
}
const wallet1 = new MeshWallet({
    networkId: 0,
    fetcher: blockchainProvider,
    submitter: blockchainProvider,
    key: {
        type: "mnemonic",
        words: wallet1Passphrase.split(' ')
    },
});

const wallet1Address = await wallet1.getChangeAddress();

const wallet1Utxos = await wallet1.getUtxos();
// const wallet1Collateral: UTxO = (await blockchainProvider.fetchUTxOs("5d69f9d07b31dc6562c0cc9967edc78cf46f76a417f03b235a664b02797731dd", 1))[0]
const wallet1Collateral: UTxO = (await wallet1.getCollateral())[0]
if (!wallet1Collateral) {
    throw new Error('No collateral utxo found');
}

const { pubKeyHash: wallet1VK, stakeCredentialHash: wallet1SK } = deserializeAddress(wallet1Address);

// Setup wallet2
const wallet2Passphrase = process.env.WALLET_PASSPHRASE_TWO;
if (!wallet2Passphrase) {
    throw new Error("WALLET_PASSPHRASE_TWO does not exist");
}
const wallet2 = new MeshWallet({
    networkId: 0,
    fetcher: blockchainProvider,
    submitter: blockchainProvider,
    key: {
        type: "mnemonic",
        words: wallet2Passphrase.split(' ')
    },
});
const wallet2Address = await wallet1.getChangeAddress();
const { pubKeyHash: wallet2VK, stakeCredentialHash: wallet2SK } = deserializeAddress(wallet2Address);

// Setup multisig
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
// console.log("nativeScript:", nativeScript);
// console.log("serializeNativeScript:", serializeNativeScript(nativeScript));
const multisigHash = resolveNativeScriptHash(nativeScript);
// console.log("multisigHash:", multisigHash);
const multiSigUtxos = await blockchainProvider.fetchAddressUTxOs(multiSigAddress);
// console.log("multiSigUtxos:", multiSigUtxos);
// console.log("multiSigUtxos:", multiSigUtxos[0].output.amount);

// Evaluator for Aiken verbose mode
const evaluator = new OfflineEvaluator(blockchainProvider, "preprod");
// Create transaction builder
const txBuilder = new MeshTxBuilder({
    fetcher: blockchainProvider,
    submitter: blockchainProvider,
    evaluator: evaluator, // Can also be "evaluator: blockchainProvider,"
    // evaluator: blockchainProvider,
    verbose: false,
});
txBuilder.setNetwork('preprod');

// test mint
// Always success mint validator
const alwaysSuccessMintValidator = "585401010029800aba2aba1aab9eaab9dab9a4888896600264653001300600198031803800cc0180092225980099b8748000c01cdd500144c9289bae30093008375400516401830060013003375400d149a26cac8009";
const alwaysSuccessValidatorMintScript = applyParamsToScript(
    alwaysSuccessMintValidator,
    [],
    "JSON",
);
const alwaysSuccessMintValidatorHash = resolveScriptHash(alwaysSuccessValidatorMintScript, "V3");
console.log("alwaysSuccessMintValidatorHash:", alwaysSuccessMintValidatorHash);

// Constants
const StPparamsAssetName = stringToHex("STP");
const StStableAssetName = stringToHex("staterite");
const StPoolNftName = stringToHex("SPN");
const StOracleAssetName = stringToHex("STO");
const StLiquidationAssetName = stringToHex("STL");

// Reference scripts
const collateralScriptTxHash = "a06509e429311b9940d3a685b91218755397de2510e297b0308427aa3edf8170";
const collateralScriptIdx = 0;
const mintStScriptTxHash = "9a92b88a1bfcd36cf24d653a3038693b40e27e74d0cc326634bf1dc06acfcccd";
const mintStScriptTxIdx = 0;
const batchingScriptTxHash = "5e353710d08f07044da43af8aa1d7e20cbb9f9b46e4b2d5ff60d9015f9414a21";
const batchingScriptTxIdx = 0;

const assetObject = {
    "ada": {
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
}

export {
    blueprint,
    maestroKey,
    wallet1Passphrase,
    blockchainProvider,
    txBuilder,
    wallet1,
    wallet1Address,
    wallet1VK,
    wallet1SK,
    wallet1Utxos,
    wallet1Collateral,
    wallet2,
    wallet2Address,
    wallet2VK,
    wallet2SK,
    multisigHash,
    multiSigAddress,
    multiSigCbor,
    multiSigUtxos,
    alwaysSuccessValidatorMintScript,
    alwaysSuccessMintValidatorHash,
    // Constants
    StPparamsAssetName,
    StStableAssetName,
    StPoolNftName,
    StOracleAssetName,
    StLiquidationAssetName,
    assetObject,
    // Ref scripts
    collateralScriptTxHash,
    collateralScriptIdx,
    mintStScriptTxHash,
    mintStScriptTxIdx,
    batchingScriptTxHash,
    batchingScriptTxIdx,
}
