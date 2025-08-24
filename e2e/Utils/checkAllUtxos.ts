import { OrderValidatorAddr, PoolValidatorAddr } from "../Batching/validators.js";
import { CollateralValidatorAddr } from "../CollateralValidator/validator.js";
import { blockchainProvider } from "../setup.js";
import { UnifiedControlValidatorAddr } from "../UnifiedControl/validator.js";

const collateralUtxos = await blockchainProvider.fetchAddressUTxOs(CollateralValidatorAddr);
const poolUtxos = await blockchainProvider.fetchAddressUTxOs(PoolValidatorAddr);
const orderUtxos = await blockchainProvider.fetchAddressUTxOs(OrderValidatorAddr);
const UnifiedControlUtxos = await blockchainProvider.fetchAddressUTxOs(UnifiedControlValidatorAddr);

console.log('\n\n\n', "Checking all utxos................", '\n');
console.log("collateralUtxos:", collateralUtxos, '\n\n');
console.log("poolUtxos:", poolUtxos, '\n\n');
console.log("orderUtxos:", orderUtxos, '\n\n');
console.log("UnifiedControlUtxos:", UnifiedControlUtxos, '\n\n');
