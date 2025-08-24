import { applyParamsToScript, builtinByteString, IWallet, mConStr, mConStr0, mConStr1, MeshTxBuilder, outputReference, UTxO } from "@meshsdk/core";
import { CollateralValidatorAddr, CollateralValidatorHash, CollateralValidatorScript, identifierTokenUnit } from "../CollateralValidator/validator";
import { AssetDetails, BlockchainProviderType, CollateralDatum } from "../types";
import { getLoanPositionDetails, getUserDepositUtxo } from "../utils";
import { UnifiedControlValidatorHash } from "../UnifiedControl/validator";
import { LoanNftValidatorExports } from "./validator";
import { MintStPolicy, MintStValidatorScript } from "../StMinting/validator";
import { setup } from "../setup";

export const repayLoan = async (
  blockchainProvider: BlockchainProviderType,
  txBuilder: MeshTxBuilder,
  wallet: IWallet,
  walletAddress: string,
  walletCollateral: UTxO,
  walletUtxos: UTxO[],
  walletVK: string,
  collateralUtxo: UTxO,
  collateralAsset: AssetDetails,
) => {
    const { collateralScriptIdx, collateralScriptTxHash, StStableAssetName } = setup();
    const { LoanNftValidator } = await LoanNftValidatorExports(walletVK, walletUtxos, collateralAsset);

    const collateralUtxoDetails = getLoanPositionDetails(collateralUtxo);
    if (!collateralUtxoDetails) {
        throw new Error(`Could not get the loan position details of utxo: ${collateralUtxo}`);
    }
    const {
    st_borrowed,
    loan_nft_pid,
    } = collateralUtxoDetails;

    let userLoanNFTUnit = "";
    // Find the loan NFT UTxO corresponding to the provided collateral UTxO
    const loanNftUtxo = walletUtxos.find(walletUtxo => {
        const walletUtxoAmountUnits = walletUtxo.output.amount.map((amount) => amount.unit);

        for (let i = 0; i < walletUtxoAmountUnits.length; i++) {
            if (walletUtxoAmountUnits[i].slice(0, 56) == loan_nft_pid) {
                userLoanNFTUnit = walletUtxoAmountUnits[i];
                return true;
            }
        }
    })

    if (userLoanNFTUnit == "") {
        throw new Error("Loan NFT UTxO with same loan_nft_pid not found");
    }
    if (!loanNftUtxo) {
        throw new Error("Loan NFT UTxO not found");
    }
    console.log("loanNftUtxo amount:", loanNftUtxo.output.amount);
    console.log("userLoanNFTUnit:", userLoanNFTUnit);
    // console.log("collateralUtxo:", collateralUtxo);

    // Get loan NFT asset details
    const loanNFTData = await blockchainProvider.get(
        "assets/" + userLoanNFTUnit
    );
    const loanNFTTxHash = loanNFTData.data.first_mint_tx.tx_hash;
    // Get the collateral utxo transaction data
    const txData = await blockchainProvider.get(
        "transactions/" + loanNFTTxHash,
    );
    // Get the utxo to use to reconstruct the loanNftValidatorScript
    const LnvsUtxo = (txData.data.inputs.filter((input: any) => (
        input.address == CollateralValidatorAddr
    )))[0];
    if (!LnvsUtxo) {
        throw new Error("LnvsUtxo not found");
    }
    // console.log("CollateralValidatorAddr:", CollateralValidatorAddr);
    // console.log("loanNFTTxHash:", loanNFTTxHash);
    // console.log("txData:", txData);
    // console.log("txData Input:", LnvsUtxo);
    // Reconstruct the loanNftValidatorScript
    const paramUtxo = outputReference(LnvsUtxo.tx_hash, LnvsUtxo.index);
    console.log("paramUtxo:", paramUtxo);
    const recLoanNftValidatorScript = applyParamsToScript(
    LoanNftValidator[0].compiledCode,
    [
        paramUtxo,
        builtinByteString(CollateralValidatorHash),
        builtinByteString(UnifiedControlValidatorHash),
    ],
    "JSON"
    );
    // console.log("recLoanNftValidatorScript hash:", resolveScriptHash(recLoanNftValidatorScript, "V3"));

    const userBalanceDatum = mConStr1([
        walletVK,
    ]);

    const userDepositUtxo = await getUserDepositUtxo(walletVK);
    // Add lovelace quantity of user balance to the collateral amount (first asset is always ADA)
    const userBalanceUpdated = Number(userDepositUtxo.output.amount[0].quantity) + Number(collateralUtxo.output.amount[0].quantity);

    const unsignedTx = await txBuilder
        // user's balance utxo in the protocol
        .spendingPlutusScriptV3()
        .txIn(
            userDepositUtxo.input.txHash,
            userDepositUtxo.input.outputIndex,
            userDepositUtxo.output.amount,
            userDepositUtxo.output.address,
        )
        .spendingTxInReference(collateralScriptTxHash, collateralScriptIdx)
        // .txInScript(CollateralValidatorScript)
        .spendingReferenceTxInInlineDatumPresent()
        .spendingReferenceTxInRedeemerValue(mConStr0([]))
        // collateral utxo containing the collateral the user locked
        .spendingPlutusScriptV3()
        .txIn(
            collateralUtxo.input.txHash,
            collateralUtxo.input.outputIndex,
            collateralUtxo.output.amount,
            collateralUtxo.output.address,
        )
        .spendingTxInReference(collateralScriptTxHash, collateralScriptIdx)
        // .txInScript(CollateralValidatorScript)
        .spendingReferenceTxInInlineDatumPresent()
        .spendingReferenceTxInRedeemerValue(mConStr(6, []))
        // burns the loan NFT
        .mintPlutusScriptV3()
        .mint("-1", userLoanNFTUnit.slice(0, 56), userLoanNFTUnit.slice(56))
        // .mintTxInReference(recLoanNftValidatorTxHash, recLoanNftValidatorTxIdx)
        .mintingScript(recLoanNftValidatorScript)
        .mintRedeemerValue(mConStr1([]))
        // burns the loan tokens (stable coin)
        .mintPlutusScriptV3()
        .mint("-".concat(String(st_borrowed)), MintStPolicy, StStableAssetName)
        // .mintTxInReference(mintStScriptTxHash, mintStScriptTxIdx)
        .mintingScript(MintStValidatorScript)
        .mintRedeemerValue(mConStr1([]))
        // send updated user balance (with the unlocked collateral amount)
        .txOut(CollateralValidatorAddr, [
            { unit: "lovelace", quantity: String(userBalanceUpdated) },
            { unit: identifierTokenUnit, quantity: "1" },
        ])
        .txOutInlineDatumValue(userBalanceDatum)
        .txInCollateral(
            walletCollateral.input.txHash,
            walletCollateral.input.outputIndex,
            walletCollateral.output.amount,
            walletCollateral.output.address,
        )
        .requiredSignerHash(walletVK)
        .changeAddress(walletAddress)
        .selectUtxosFrom(walletUtxos)
        .complete()

    const signedTx = await wallet.signTx(unsignedTx, true);
    const txHash = await wallet.submitTx(signedTx);

    txBuilder.reset();

    return txHash;
}
