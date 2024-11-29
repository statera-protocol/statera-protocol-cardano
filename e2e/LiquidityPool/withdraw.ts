import { applyParamsToScript, builtinByteString, serializePlutusScript } from "@meshsdk/core";
import { blockchainProvider, blueprint, txBuilder, wallet1, wallet1Address, wallet1Collateral, wallet1Utxos, wallet1VK } from "../setup.js";

// Liquidity Pool Validator
const LiquidityPoolValidator = blueprint.validators.filter((val) => val.title.includes('liquidity_pool.spend'));
if (!LiquidityPoolValidator) {
    throw new Error('Liquidity Pool Validator not found!');
}

const parameterizedScript = applyParamsToScript(
    LiquidityPoolValidator[0].compiledCode,
    [builtinByteString(wallet1VK)],
    "JSON"
);

const scriptAddr = serializePlutusScript(
    { code: parameterizedScript, version: 'V3' },
    undefined,
    0
).address;
// console.log('tUSD liquidity pool address:', scriptAddr, '\n');

const lockedUTxosWithDatum = await blockchainProvider.fetchAddressUTxOs(scriptAddr);
console.log(lockedUTxosWithDatum);
const lockedUTxoWithDatum = lockedUTxosWithDatum[0];

// throw error for an invalid utxo
if (!lockedUTxoWithDatum) {
    throw new Error("No utxos to unlock");
}

const unlockWithDatumTx = await txBuilder
    .spendingPlutusScript('V3')
    .txIn(
        lockedUTxoWithDatum.input.txHash,
        lockedUTxoWithDatum.input.outputIndex,
        lockedUTxoWithDatum.output.amount,
        scriptAddr
    )
    .spendingReferenceTxInInlineDatumPresent()
    .spendingReferenceTxInRedeemerValue("")
    .txInScript(parameterizedScript)
    .txOut(wallet1Address, [])
    .txInCollateral(
        wallet1Collateral.input.txHash,
        wallet1Collateral.input.outputIndex,
        wallet1Collateral.output.amount,
        wallet1Collateral.output.address,
    )
    .requiredSignerHash(wallet1VK)
    .changeAddress(wallet1Address)
    .selectUtxosFrom(wallet1Utxos)
    .complete();

const signedTx = await wallet1.signTx(unlockWithDatumTx);
const txHash = await wallet1.submitTx(signedTx);

console.log('Unlock from liquidity poool tx hash:', txHash);
