import Head from "next/head";
import { CardanoWallet, MeshBadge, useWallet } from "@meshsdk/react";
import { configureApp } from "../../utils/configureApp";
import { useEffect, useState } from "react";
import { MaestroProvider, MeshTxBuilder, UTxO } from "@meshsdk/core";
import { Input } from "@/layout/Input";
import { Button } from "@/layout/Button";
import { deposit } from "../../utils/deposit";
import { increaseDeposit } from "../../utils/increaseDeposit";
import { calculateLoanAmount } from "../../utils/util";
import { borrow } from "../../utils/borrow";

type DappStateType = {
  walletUtxos: UTxO[],
  walletVK: string,
  walletAddress: string,
  walletCollateral: UTxO,
  blockchainProvider: MaestroProvider,
  txBuilder: MeshTxBuilder,
  aBorrowInput: UTxO,
  oracleAddress: string,
  mintLoanValidatorScript: string,
  mintLoanValidatorAddress: string,
  mintLoanScriptHash: string,
  loanNftPolicyId: string,
  loanNftValidatorScript: string,
  collateralValidatorAddress: string,
  collateralValidatorScript: string,
  mintLoanUnit: string,
  mintLoanPolicyId: string,
  mintLoanAssetNameHex: string,
  oracleUtxo: UTxO | undefined,
  oracleUtxoForLiquidation: UTxO | undefined,
  protocolParametersUtxo: UTxO | undefined,
  mintLoanValidatorCode: any,
  loanNftValidatorCode: any,
  protocolParametersAddress: string,
  collateralValidatorScriptHash: string,
  protocolParametersScriptHash: string,
  oracleScriptHash: string,
  userDepositUtxos: UTxO[],
  multiSigAddress: string,
  multisigHash: string,
}

export default function Home() {
  const { wallet, connected, } = useWallet()
  const [DappState, setDappState] = useState<DappStateType>();
  const [addDepositAmount, setAddDepositAmount] = useState<string>("");
  const [increaseDepositAmount, setIncreaseDepositAmount] = useState<string>("");
  const [borrowAmount, setBorrowAmount] = useState<string>("");

  const handleOnConnected = async () => {
    const gottenDappState = await configureApp(wallet);
    setDappState(gottenDappState);
    console.log("\n\n\n", DappState, "\n\n\n");
  }

  const handleAddDeposit = async () => {
    if (!DappState) {
      throw new Error("Dapp state isn't initialized");
    }

    const {
      txBuilder,
      walletAddress,
      walletCollateral,
      walletUtxos,
      walletVK,
      collateralValidatorAddress,
      collateralValidatorScript,
      collateralValidatorScriptHash
    } = DappState;
    await deposit(
      txBuilder, wallet,
      walletAddress,
      walletCollateral,
      walletUtxos,
      walletVK,
      collateralValidatorAddress,
      collateralValidatorScript,
      collateralValidatorScriptHash,
      addDepositAmount,
    );
  }

  const handleIncreaseDeposit = async () => {
    if (!DappState) {
      throw new Error("Dapp state isn't initialized");
    }

    const { txBuilder,
      walletAddress,
      walletCollateral,
      walletUtxos,
      walletVK,
      collateralValidatorAddress,
      collateralValidatorScript,
      userDepositUtxos
    } = DappState;
    await increaseDeposit(
      txBuilder,
      wallet,
      walletAddress,
      walletCollateral,
      walletUtxos,
      walletVK,
      collateralValidatorAddress,
      collateralValidatorScript,
      userDepositUtxos,
      increaseDepositAmount,
    );
  }

  const getLoanAmount = (collateralAmmountInLovelaces: string) => {
    if (!DappState) {
      throw new Error("Dapp state isn't initialized");
    }

    const { oracleUtxo, protocolParametersUtxo, } = DappState;
    const [oracleRate, loanAmount] = calculateLoanAmount(
      oracleUtxo?.output.amount,
      protocolParametersUtxo?.output.plutusData,
      collateralAmmountInLovelaces,
    );

    return { oracleRate, loanAmount };
  }

  const handleBorrowLoan = async (collateralAmmountInLovelaces: string) => {
    if (!DappState) {
      throw new Error("Dapp state isn't initialized");
    }

    const {
      txBuilder,
      walletAddress,
      walletCollateral,
      walletUtxos,
      walletVK,
      collateralValidatorAddress,
      collateralValidatorScript,
      userDepositUtxos,
      loanNftPolicyId,
      loanNftValidatorScript,
      oracleUtxo,
      protocolParametersUtxo,
      mintLoanAssetNameHex,
      mintLoanPolicyId,
      mintLoanUnit,
      mintLoanValidatorScript,
    } = DappState;
    await borrow(
      txBuilder,
      wallet,
      walletAddress,
      walletCollateral,
      walletUtxos,
      walletVK,
      collateralValidatorAddress,
      collateralValidatorScript,
      userDepositUtxos,
      loanNftPolicyId,
      loanNftValidatorScript,
      oracleUtxo,
      protocolParametersUtxo,
      mintLoanAssetNameHex,
      mintLoanPolicyId,
      mintLoanUnit,
      mintLoanValidatorScript,
      collateralAmmountInLovelaces,
    );
  }

  return (
    <div className="bg-gray-900 w-full text-white text-center">
      <Head>
        <title>Statera Protocol</title>
        <meta name="description" content="A Cardano dApp powered my Mesh" />
      </Head>
      <main
        className={`flex min-h-screen flex-col items-center justify-center p-24`}
      >
        <h1 className="text-6xl font-thin mb-20">
          <a href="https://meshjs.dev/" className="text-sky-600">
            Statera
          </a>{" "}
          Protocol
        </h1>

        <div className="mb-20">
          <CardanoWallet onConnected={handleOnConnected} />
        </div>

        {/* The Application */}
        {connected && <div className="mb-20">
          <p className="text-xl">Your balance in Statera: <i>{DappState ? `${(Number(DappState.userDepositUtxos[0].output.amount[0].quantity) / 1000000)} ADA` : "__"}</i></p>
          <h3 className="mb-6 mt-12 text-4xl font-bold">Deposit</h3>
          {DappState?.userDepositUtxos.length ?
            (<>
              <Input
                type="text"
                name="increaseDepositAmount"
                id="increaseDepositAmount"
                value={increaseDepositAmount}
                onInput={(e) => setIncreaseDepositAmount(e.currentTarget.value)}
              >
                Increase Deposit
              </Input>
              <Button
                className="my-4"
                onClick={handleIncreaseDeposit}
                disabled={!increaseDepositAmount}
              >
                Deposit
              </Button>

              <h3 className="mb-6 mt-12 text-4xl font-bold">Borrow Fundz</h3>
              <p>Your account balance of<span> </span>
                <i>{`${(Number(DappState.userDepositUtxos[0].output.amount[0].quantity) / 1000000)} ADA`}</i><span> </span>
                can get you a maximum loan of <i>{getLoanAmount(DappState.userDepositUtxos[0].output.amount[0].quantity).loanAmount} tUSD</i>
              </p>
              <Input
                type="text"
                name="borrowAmount"
                id="borrowAmount"
                value={borrowAmount}
                onInput={(e) => setBorrowAmount(e.currentTarget.value)}
              >
                Put in collateral amount (ADA)
              </Input>
              <p>Equivalent loan amount in tUSD (Make sure this is a whole number): <i>{getLoanAmount(String(Number(borrowAmount) * 1000000)).loanAmount}</i></p>
              <Button
                className="my-4"
                onClick={() => handleBorrowLoan(borrowAmount)}
                disabled={!borrowAmount}
              >
                Get Loan
              </Button>
            </>)
            :
            (<>
              <Input
                type="text"
                name="addDepositAmount"
                id="addDepositAmount"
                value={addDepositAmount}
                onInput={(e) => setAddDepositAmount(e.currentTarget.value)}
              >
                Add Deposit/Create Account
              </Input>
              <Button
                className="my-4"
                onClick={handleAddDeposit}
                disabled={!addDepositAmount}
              >
                Deposit
              </Button>
            </>)
          }
        </div>}
      </main>
      <footer className="p-8 border-t border-gray-300 flex justify-center">
        <MeshBadge isDark={true} />
      </footer>
    </div>
  );
}
