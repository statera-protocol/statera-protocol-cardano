import { IWallet, mConStr, mConStr0, mConStr1, mConStr2, MeshTxBuilder, stringToHex, UTxO } from "@meshsdk/core";
import { calculateLoanAdaAmount } from "./util";
import { cVRSTxHash, cVRSTxIndex, mintLoanScriptTxHash, mintLoanScriptTxIndex } from "./setup";

export const borrow = async (
    txBuilder: MeshTxBuilder,
    wallet: IWallet,
    walletAddress: string,
    walletCollateral: UTxO,
    walletUtxos: UTxO[],
    walletVK: string,
    collateralValidatorAddress: string,
    userDepositUtxos: UTxO[],
    loanNftPolicyId: string,
    loanNftValidatorScript: string,
    oracleUtxo: UTxO | undefined,
    protocolParametersUtxo: UTxO | undefined,
    mintLoanAssetNameHex: string,
    mintLoanPolicyId: string,
    mintLoanUnit: string,
    tUSDLoanAmount: string,
    identifierTokenUnit: string,
) => {
    if (!oracleUtxo) {
        throw new Error('Oracle UTxO not found!');
    }
    if (!protocolParametersUtxo) {
        throw new Error('Protocol Parameters UTxO not found!');
    }

    const loanNftName = "statera-brw" + "-" + (String(userDepositUtxos[0].input.txHash).slice(0, 3) + "#" + String(userDepositUtxos[0].input.outputIndex));
    const loanNftNameHex = stringToHex(loanNftName);
    const loanNftUnit = loanNftPolicyId + loanNftNameHex;

    const [oracleRate, loanAmountAda] = calculateLoanAdaAmount(
        oracleUtxo?.output.amount,
        protocolParametersUtxo.output.plutusData,
        tUSDLoanAmount,
    );

    console.log('oracleRate:', oracleRate);
    console.log('loanAmountAda:', loanAmountAda);

    const changeAmount = Number(userDepositUtxos[0].output.amount[0].quantity) - Number(loanAmountAda);

    const collateralDatum = mConStr0([
        mintLoanPolicyId,
        mintLoanPolicyId,
        mintLoanAssetNameHex,
        Number(tUSDLoanAmount),
        loanNftPolicyId,
        loanNftNameHex,
        Math.ceil(oracleRate * 1000000), // USD multiplied by ADA lovelaces bcs no decimals in blockhain
        "ada",
        Number(loanAmountAda),
    ]);

    const depositDatum = mConStr1([
        walletVK
    ]);

    console.log("in borrow, oracle utxo:", oracleUtxo);
    console.log("collateralValidatorAddress:", collateralValidatorAddress);

    const unsignedTx = await txBuilder
        // spend deposit utxo by user
        .spendingPlutusScriptV3()
        .txIn(
            userDepositUtxos[0].input.txHash,
            userDepositUtxos[0].input.outputIndex,
            userDepositUtxos[0].output.amount,
            userDepositUtxos[0].output.address,
        )
        .spendingTxInReference(cVRSTxHash, cVRSTxIndex)
        .spendingReferenceTxInInlineDatumPresent()
        .spendingReferenceTxInRedeemerValue(mConStr(2, []))
        // mint loan NFT
        .mintPlutusScriptV3()
        .mint("1", loanNftPolicyId, loanNftNameHex)
        .mintingScript(loanNftValidatorScript)
        .mintRedeemerValue(mConStr0([]))
        // mint loan tokens
        .mintPlutusScriptV3()
        .mint(tUSDLoanAmount, mintLoanPolicyId, mintLoanAssetNameHex)
        .mintTxInReference(mintLoanScriptTxHash, mintLoanScriptTxIndex)
        .mintRedeemerValue(mConStr0([]))
        // send collateral to collateral validator address
        .txOut(collateralValidatorAddress, [ { unit: "lovelace", quantity: String(loanAmountAda) } ])
        .txOutInlineDatumValue(collateralDatum)
        // send change as deposit to collateral validator address
        .txOut(collateralValidatorAddress, [ { unit: "lovelace", quantity: String(changeAmount) }, { unit: identifierTokenUnit, quantity: "1" } ])
        .txOutInlineDatumValue(depositDatum)
        // send loan NFT and loan tokens to borrower
        .txOut(walletAddress, [ { unit: loanNftUnit, quantity: "1" }, { unit: mintLoanUnit, quantity: tUSDLoanAmount }])
        .readOnlyTxInReference(oracleUtxo.input.txHash, oracleUtxo.input.outputIndex)
        .readOnlyTxInReference(protocolParametersUtxo.input.txHash, protocolParametersUtxo.input.outputIndex)
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

    const signedTx = await wallet.signTx(unsignedTx);
    const txHash = await wallet.submitTx(signedTx);

    console.log('Statera Borrow tx Hash:', txHash);
}
