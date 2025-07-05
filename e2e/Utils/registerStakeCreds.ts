import { BatchingRewardAddr, OrderValidatorRewardAddr } from "../Batching/validators.js";
import { txBuilder, wallet1, wallet1Address, wallet1Utxos } from "../setup.js";

// withdraw zero setup (register all stake cert) - Merged
const unsignedTx = await txBuilder
    .registerStakeCertificate(BatchingRewardAddr)
    .registerStakeCertificate(OrderValidatorRewardAddr)
    // .registerStakeCertificate(ExampleRewardAddr)
    .selectUtxosFrom(wallet1Utxos)
    .changeAddress(wallet1Address)
    .complete();
const signedTx = await wallet1.signTx(unsignedTx);
const txHash = await wallet1.submitTx(signedTx);
console.log("register all stake certificate tx hash:", txHash);
