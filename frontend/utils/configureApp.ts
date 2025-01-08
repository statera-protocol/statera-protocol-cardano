import { deserializeAddress, IWallet, MaestroProvider, MeshTxBuilder, UTxO } from "@meshsdk/core";
import { OfflineEvaluator } from "@meshsdk/core-csl";
import { setup } from "./setup";

export const configureApp = async (wallet: IWallet) => {
  // Setup blockhain provider as Maestro
  const maestroKey = process.env.NEXT_PUBLIC_MAESTRO_KEY;
  if (!maestroKey) {
    throw new Error("MAESTRO_KEY does not exist");
  }
  const blockchainProvider = new MaestroProvider({
    network: 'Preprod',
    apiKey: maestroKey,
  });

  const walletAddress = await wallet.getChangeAddress();

  const walletUtxos = await wallet.getUtxos();
  const walletCollateral: UTxO = (await wallet.getCollateral())[0]
  if (!walletCollateral) {
    throw new Error('No collateral utxo found');
  }

  const { pubKeyHash: walletVK } = deserializeAddress(walletAddress);

  // Evaluator for Aiken verbose mode
  const evaluator = new OfflineEvaluator(blockchainProvider, "preprod");
  // Create transaction builder
  const txBuilder = new MeshTxBuilder({
    fetcher: blockchainProvider,
    submitter: blockchainProvider,
    evaluator: evaluator, // Can also be "evaluator: blockchainProvider,"
    verbose: true,
  });
  txBuilder.setNetwork('preprod');

  const setupResult = await setup(blockchainProvider, walletUtxos, walletVK);

  // remove this log
  console.log(
    {
      walletUtxos,
      walletVK,
      walletAddress,
      walletCollateral,
      blockchainProvider,
      txBuilder,
      ...setupResult,
    }
  );

  return {
    walletUtxos,
    walletVK,
    walletAddress,
    walletCollateral,
    blockchainProvider,
    txBuilder,
    ...setupResult,
  };
}
