import { deserializeDatum, mConStr0, serializeAddressObj } from "@meshsdk/core";
import { blockchainProvider, txBuilder, wallet1, wallet1Address, wallet1Collateral, wallet1Utxos } from "../setup.js";
import { OrderValidatorAddr, OrderValidatorRewardAddr, OrderValidatorScript } from "./validators.js";
import { OrderDatumType } from "../types.js";

const AllOrderUtxos = await blockchainProvider.fetchAddressUTxOs(OrderValidatorAddr);
const orderUtxo = AllOrderUtxos[0];
const orderPlutusData = orderUtxo.output.plutusData;
if (!orderPlutusData) throw new Error("order plutus data doesn't exist");
const orderDatum = deserializeDatum<OrderDatumType>(orderPlutusData);

const orderCanceller = orderDatum.fields[2].bytes;
const orderAddress = serializeAddressObj(orderDatum.fields[1]);
// console.log("orderAddress:", orderAddress);
// console.log("orderCanceller:", orderCanceller);

const unsignedTx = await txBuilder
  .withdrawalPlutusScriptV3()
  .withdrawal(OrderValidatorRewardAddr, "0")
  .withdrawalScript(OrderValidatorScript)
  .withdrawalRedeemerValue(mConStr0([]))
  .spendingPlutusScriptV3()
  .txIn(
      orderUtxo.input.txHash,
      orderUtxo.input.outputIndex,
      orderUtxo.output.amount,
      orderUtxo.output.address,
  )
  .txInScript(OrderValidatorScript)
  .spendingReferenceTxInInlineDatumPresent()
  .spendingReferenceTxInRedeemerValue("")
  .txOut(orderAddress, orderUtxo.output.amount)
  .txInCollateral(
    wallet1Collateral.input.txHash,
    wallet1Collateral.input.outputIndex,
    wallet1Collateral.output.amount,
    wallet1Collateral.output.address,
  )
  .changeAddress(wallet1Address)
  .selectUtxosFrom(wallet1Utxos)
  .requiredSignerHash(orderCanceller)
  .complete()

const signedTx = await wallet1.signTx(unsignedTx);

const txHash = await wallet1.submitTx(signedTx);
console.log("Cancel order:", txHash);
