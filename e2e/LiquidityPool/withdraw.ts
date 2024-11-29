import { applyParamsToScript, builtinByteString, serializePlutusScript } from "@meshsdk/core";
import { blockchainProvider, blueprint, wallet1VK } from "../setup.js";

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

// const liquidityPoolUtxos = await blockchainProvider.fetchAddressUTxOs(scriptAddr);
// console.log('Liquidity Pool Utxos:\n', liquidityPoolUtxos);


