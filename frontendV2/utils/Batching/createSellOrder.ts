import { IWallet, mConStr0, mConStr1, MeshTxBuilder, mPubKeyAddress, UTxO } from "@meshsdk/core";
import { OrderValidatorAddr } from "./validators";
import { stUnit } from "../StMinting/validator";
import { setup } from "../setup";

export const createSellOrder = async (
    txBuilder: MeshTxBuilder,
    wallet: IWallet,
    walletAddress: string,
    walletUtxos: UTxO[],
    walletVK: string,
    walletSK: string,
    amount: number,
    assetName: string,
) => {
    const { assetObject } = setup();
    
    const mAddr = mPubKeyAddress(walletVK, walletSK);

    const orderAsset = assetObject[assetName];

    const OrderDatum = mConStr0([
        mConStr1([]), // Sell
        mAddr,
        walletVK,
        mConStr0([
            mConStr1([]),
            orderAsset.policy,
            orderAsset.name,
        ]),
    ]);

    const unsignedTx = await txBuilder
        .txOut(OrderValidatorAddr, [{ unit: stUnit, quantity: String(amount * 1000000) }])
        .txOutInlineDatumValue(OrderDatum)
        .changeAddress(walletAddress)
        .selectUtxosFrom(walletUtxos)
        .complete()

    const signedTx = await wallet.signTx(unsignedTx, true);
    const txHash = await wallet.submitTx(signedTx);

    txBuilder.reset();

    return txHash;
}
