import { mConStr2, mConStr3 } from "@meshsdk/core";
import { txBuilder, wallet1, wallet1Address, wallet1Collateral, wallet1Utxos } from "../setup.js";
import { mintLoanAssetNameHex, mintLoanScriptHash, mintLoanUnit, mintLoanValidatorScript, oracleAddress } from "./setup.js";

const mintQuantity = "24";

const unsignedTx = await txBuilder
    .mintPlutusScriptV3()
    .mint(mintQuantity, mintLoanScriptHash, mintLoanAssetNameHex)
    .mintingScript(mintLoanValidatorScript)
    .mintRedeemerValue(mConStr3([]))
    // Normal rate
    .txOut(oracleAddress, [{ unit: "lovelace", quantity: "20000000" }, { unit: mintLoanUnit, quantity: mintQuantity }])
    // For liquidation
    // .txOut(oracleAddress, [{ unit: "lovelace", quantity: "15000000" }, { unit: mintLoanUnit, quantity: "12" }])
    .changeAddress(wallet1Address)
    .selectUtxosFrom(wallet1Utxos)
    .txInCollateral(
        wallet1Collateral.input.txHash,
        wallet1Collateral.input.outputIndex,
        wallet1Collateral.output.amount,
        wallet1Collateral.output.address,
    )
    .complete()

const signedTx = await wallet1.signTx(unsignedTx);
const txHash = await wallet1.submitTx(signedTx);

console.log('tx Hash:', txHash);
