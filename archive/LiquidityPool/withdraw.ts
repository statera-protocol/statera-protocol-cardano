import { applyParamsToScript, builtinByteString, mConStr0, mConStr1, resolveScriptHash, serializePlutusScript, slotToBeginUnixTime, stringToHex } from "@meshsdk/core";
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
console.log('tUSD liquidity pool address:', scriptAddr, '\n');

const lockedUTxosWithDatum = await blockchainProvider.fetchAddressUTxOs(scriptAddr);
console.log(lockedUTxosWithDatum);
let lockedUTxoWithDatum = lockedUTxosWithDatum[0];

// throw error for an invalid utxo
if (!lockedUTxoWithDatum) {
    throw new Error("No utxos to unlock");
}


// Burn Tx
const validatorScript = applyParamsToScript(
    "59013b010100323232323232322533300232323232325332330083001300937540042646464a66601660080022a66601c601a6ea80180085854ccc02ccdc3a40040022a66601c601a6ea80180085858c02cdd500289919299980718088010992999806180298069baa0071337109000000899b8800148000dd698068008b180780099299980519b8748008c02cdd50008a5eb7bdb1804dd5980798061baa00132330010013756601e602060206020602060186ea8018894ccc038004530103d87a8000132333222533300f3372200e0062a66601e66e3c01c00c4cdd2a4000660266e980092f5c02980103d87a8000133006006001375c601a0026eacc038004c048008c040004dd7180698051baa002370e90000b1805980600198050011804801180480098021baa00114984d9595cd2ab9d5573caae7d5d02ba157441",
    []
);
const policyId = resolveScriptHash(validatorScript, "V3");
const tokenName = 'tUSD';
const tokenNameHex = stringToHex(tokenName);

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
    // burn
    .mintPlutusScriptV3()
    .mint("-100", policyId, tokenNameHex)
    .mintingScript(validatorScript)
    .mintRedeemerValue(mConStr1([]))
    // .txOut('addr_test1wrp59dplx70xac39tqms9wzp5eptnvxwwehaem5m0fhklwqq92aad', [{ unit: `${policyId}${tokenNameHex}`, quantity: '100' }])
    // burn
    // .txOut(wallet1Address, [])
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
