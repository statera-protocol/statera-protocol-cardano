import { IWallet, mConStr0, mConStr1, MeshTxBuilder, stringToHex, UTxO } from "@meshsdk/core";
import { CollateralValidatorAddr, identifierTokenUnit } from "../CollateralValidator/validator";
import { MintStPolicy, MintStValidatorScript, stUnit } from "../StMinting/validator";
import { getMinCollateral, getOracleUtxo, getPParamsUtxo, getUserDepositUtxo } from "../utils";
import { setup } from "../setup";
import { LoanNftValidatorExports } from "./validator";
import { AssetDetails } from "../types";

export const takeLoan = async (
  txBuilder: MeshTxBuilder,
  wallet: IWallet,
  walletAddress: string,
  walletCollateral: UTxO,
  walletUtxos: UTxO[],
  walletVK: string,
  collateralAsset: AssetDetails,
  collateralAmmountInLovelaces: number,
  stBorrowed: number,
) => {
  const { collateralScriptIdx, collateralScriptTxHash, StStableAssetName } = setup();
  const { LoanNftPolicy, LoanNftValidatorScript } = await LoanNftValidatorExports(walletVK, walletUtxos, collateralAsset);

  console.log("collateralAmmountInLovelaces:", collateralAmmountInLovelaces);
  console.log("stBorrowed:", stBorrowed);

  const oracleUtxo = getOracleUtxo();
  const pParamsUtxo = getPParamsUtxo();

  const userDepositUtxo = await getUserDepositUtxo(walletVK);
  console.log("userDepositUtxo:", userDepositUtxo);
  const loanNftName = "st-loan" + "-" + (String(userDepositUtxo.input.txHash).slice(0, 5) + "#" + String(userDepositUtxo.input.outputIndex));
  // const loanNftName = "St-New-Model-Liquidation";
  const loanNftNameHex = stringToHex(loanNftName);
  const loanNftUnit = LoanNftPolicy + loanNftNameHex;

  const [assetUsdRatePrecised, minCollateral] = getMinCollateral(
      Number(collateralAmmountInLovelaces),
      collateralAsset.unit,
  );

  if (collateralAmmountInLovelaces >= minCollateral) throw new Error("You have to provide minimum collateral");

  console.log("assetUsdRatePrecised:", assetUsdRatePrecised);
  console.log("minCollateral:", minCollateral);
  console.log("loanNftName:", loanNftName);

  const changeAmount = Number(userDepositUtxo.output.amount[0].quantity) - Number(collateralAmmountInLovelaces);

  const collateralDatum = mConStr0([
    MintStPolicy,
    StStableAssetName,
    stBorrowed,
    LoanNftPolicy,
    loanNftNameHex,
    assetUsdRatePrecised,
    mConStr0([
      mConStr0([]),
      collateralAsset.policy,
      collateralAsset.name,
    ]),
    Number(collateralAmmountInLovelaces),
  ]);

  const depositDatum = mConStr1([
    walletVK
  ]);

  const unsignedTx = await txBuilder
      // spend deposit utxo by user
      .spendingPlutusScriptV3()
      .txIn(
          userDepositUtxo.input.txHash,
          userDepositUtxo.input.outputIndex,
          userDepositUtxo.output.amount,
          userDepositUtxo.output.address,
      )
      // .txInScript(CollateralValidatorScript)
      .spendingTxInReference(collateralScriptTxHash, collateralScriptIdx)
      .spendingReferenceTxInInlineDatumPresent()
      .spendingReferenceTxInRedeemerValue(mConStr1([]))
      // mint loan NFT
      .mintPlutusScriptV3()
      .mint("1", LoanNftPolicy, loanNftNameHex)
      .mintingScript(LoanNftValidatorScript)
      .mintRedeemerValue(mConStr0([]))
      // mint loan tokens
      .mintPlutusScriptV3()
      .mint(String(stBorrowed), MintStPolicy, StStableAssetName)
      .mintingScript(MintStValidatorScript)
      .mintRedeemerValue(mConStr0([]))
      // send collateral to collateral validator address
      .txOut(CollateralValidatorAddr, [ { unit: "lovelace", quantity: String(collateralAmmountInLovelaces) } ])
      .txOutInlineDatumValue(collateralDatum)
      // send change as deposit to collateral validator address
      .txOut(CollateralValidatorAddr, [ { unit: "lovelace", quantity: String(changeAmount) }, { unit: identifierTokenUnit, quantity: "1" } ])
      .txOutInlineDatumValue(depositDatum)
      // send loan NFT and loan tokens to borrower
      .txOut(walletAddress, [ { unit: loanNftUnit, quantity: "1" }, { unit: stUnit, quantity: String(stBorrowed) }])
      .readOnlyTxInReference(oracleUtxo.input.txHash, oracleUtxo.input.outputIndex)
      .readOnlyTxInReference(pParamsUtxo.input.txHash, pParamsUtxo.input.outputIndex)
      // use collateral ADA for failed transactions from user's wallet address
      .txInCollateral(
          walletCollateral.input.txHash,
          walletCollateral.input.outputIndex,
          walletCollateral.output.amount,
          walletCollateral.output.address,
      )
      .changeAddress(walletAddress)
      .requiredSignerHash(walletVK)
      .selectUtxosFrom(walletUtxos)
      .complete()

  const signedTx = await wallet.signTx(unsignedTx, true);
  const txHash = await wallet.submitTx(signedTx);

  txBuilder.reset();

  return txHash;
}
