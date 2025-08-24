import { IWallet, mConStr0, MeshTxBuilder, UTxO } from "@meshsdk/core";
import { OrderValidatorRewardAddr, OrderValidatorScript } from "./validators";

export const cancelOrder = async (
    txBuilder: MeshTxBuilder,
    wallet: IWallet,
    walletUtxos: UTxO[],
    walletCollateral: UTxO,
    orderUtxo: UTxO,
    orderCanceller: string,
    orderAddress: string,
) => {
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
      walletCollateral.input.txHash,
      walletCollateral.input.outputIndex,
      walletCollateral.output.amount,
      walletCollateral.output.address,
    )
    .changeAddress(orderAddress)
    .selectUtxosFrom(walletUtxos)
    .requiredSignerHash(orderCanceller)
    .complete()

  const signedTx = await wallet.signTx(unsignedTx, true);
  const txHash = await wallet.submitTx(signedTx);

  txBuilder.reset();

  return txHash;
}
