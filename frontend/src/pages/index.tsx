import Head from "next/head";
import { CardanoWallet, MeshBadge, useWallet } from "@meshsdk/react";
import { configureApp } from "../../utils/configureApp";
import { useEffect, useState } from "react";
import { BlockfrostProvider, MaestroProvider, MeshTxBuilder, UTxO } from "@meshsdk/core";
import { Input } from "@/layout/Input";
import { Button } from "@/layout/Button";
import { deposit } from "../../utils/deposit";
import { increaseDeposit } from "../../utils/increaseDeposit";
import { calculateLoanAmount } from "../../utils/util";
import { borrow } from "../../utils/borrow";
import { getLoanPositionDetails, getLoanPositions } from "../../utils/getLoanPositions";
import { repayLoan } from "../../utils/repay";
import { withdraw } from "../../utils/withdraw";

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
  const { wallet, connected } = useWallet()
  const [DappState, setDappState] = useState<DappStateType>();
  const [addDepositAmount, setAddDepositAmount] = useState<string>("");
  const [increaseDepositAmount, setIncreaseDepositAmount] = useState<string>("");
  const [borrowAmount, setBorrowAmount] = useState<string>("");
  const [loanAmount, setLoanAmount] = useState(0);
  const [loanPositions, setloanPositions] = useState<UTxO[]>([]);
  const [loanPositionsDisplay, setloanPositionsDisplay] = useState<number>(0);

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

    setAddDepositAmount("");
  }

  const handleIncreaseDeposit = async () => {
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

    setIncreaseDepositAmount("");
  }

  const trackBorrow = (borrowAmountInput: string) => {
    setBorrowAmount(borrowAmountInput);
    setLoanAmount(getLoanAmount(String(Number(borrowAmountInput) * 1000000)).loanAmount);
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

    setBorrowAmount("");
  }

  const handleGetLoanPositions = async() => {
    if (!DappState) {
      throw new Error("Dapp state isn't initialized");
    }

    const { blockchainProvider, collateralValidatorAddress, walletUtxos } = DappState;
    setloanPositions(await getLoanPositions(blockchainProvider, collateralValidatorAddress, walletUtxos));
    setloanPositionsDisplay(1);
  }

  const handleRepayLoan = async (loanPosition: UTxO) => {
    if (!DappState) {
      throw new Error("Dapp state isn't initialized");
    }

    const {
      blockchainProvider,
      txBuilder,
      walletAddress,
      walletCollateral,
      walletUtxos,
      collateralValidatorScript,
      collateralValidatorAddress,
      loanNftValidatorCode,
      oracleUtxo,
      mintLoanAssetNameHex,
      mintLoanPolicyId,
      mintLoanValidatorScript,
      collateralValidatorScriptHash,
      protocolParametersScriptHash,
      oracleScriptHash,
    } = DappState;
    await repayLoan(
      blockchainProvider,
      txBuilder,
      wallet,
      walletAddress,
      walletCollateral,
      walletUtxos,
      collateralValidatorScript,
      collateralValidatorAddress,
      loanNftValidatorCode,
      oracleUtxo,
      mintLoanAssetNameHex,
      mintLoanPolicyId,
      mintLoanValidatorScript,
      collateralValidatorScriptHash,
      protocolParametersScriptHash,
      oracleScriptHash,
      loanPosition,
    );
  }

  const handleWithdrawAll = async () => {
    if (!DappState) {
      throw new Error("Dapp state isn't initialized");
    }

    const {
      txBuilder,
      walletAddress,
      walletCollateral,
      walletUtxos,
      walletVK,
      collateralValidatorScript,
      userDepositUtxos
    } = DappState;
    await withdraw(
      wallet,
      txBuilder,
      collateralValidatorScript,
      userDepositUtxos,
      walletAddress,
      walletCollateral,
      walletUtxos,
      walletVK,
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
          <a href="https://github.com/Halalend/" className="text-sky-600">
            Statera
          </a>{" "}
          Protocol
        </h1>

        <div className="mb-20">
          <CardanoWallet onConnected={handleOnConnected} />
        </div>

        {/* The Application */}
        {connected && (DappState ? (<div className="mb-20">
          <p className="text-xl">Your balance in Statera: <i>{DappState.userDepositUtxos.length > 0 ? `${(Number(DappState.userDepositUtxos[0].output.amount[0].quantity) / 1000000)} ADA` : `0 ADA`}</i></p>
          {DappState.userDepositUtxos.length > 0 && <Button
            className="my-4 mb-6"
            onClick={handleWithdrawAll}
            disabled={false}
          >
            Withdraw All
          </Button>}
          <h3 className="mb-6 mt-12 text-4xl font-bold">Deposit</h3>
          {DappState.userDepositUtxos.length <= 0 ? (
            <p className="italic text-xl text-red-500">You seem to be a new User.. You can deposit to get started.
            <br />Recommended minimum deposit: 200 ADA
            </p>
          ) : ""}
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
                <br />
                Note: You can borrow a minimum of <i>100</i> tUSD
              </p>
              <Input
                type="text"
                name="borrowAmount"
                id="borrowAmount"
                value={borrowAmount}
                onInput={(e) => trackBorrow(e.currentTarget.value)}
              >
                Put in collateral amount (ADA)
              </Input>
              <p>Equivalent loan amount in tUSD (Make sure this is a whole number): <i>{loanAmount}</i></p>
              <Button
                className="my-4"
                onClick={() => handleBorrowLoan(String(Number(borrowAmount) * 1000000))}
                disabled={!borrowAmount || (loanAmount < 100 && !Number.isInteger(Number(loanAmount)))} // make isInteger work well
              >
                Get Loan
              </Button>

              <h3 className="mb-6 mt-12 text-4xl font-bold">Loan Positions</h3>
              <Button
                className="my-4"
                onClick={handleGetLoanPositions}
                disabled={false}
              >
                Show Loan Positions
              </Button>
              {(loanPositions.length) ? (<div>
                <ol className="list-decimal">
                  {loanPositions.map((loanPosition, idx) => {
                    const loanPositionDetails = getLoanPositionDetails(loanPosition)
                    if (!loanPositionDetails) {
                      throw new Error(`Could not get the loan position details of utxo: ${loanPosition}`);
                    }
                    const { tusd_borrowed, collateral_amount_in_lovelace, loan_nft_pid } = loanPositionDetails;

                    return (
                    <li key={idx} className="mb-5 mt-3">
                      Loan NFT PolicyID: {loan_nft_pid} <br />
                      Loan Amount: <i>{tusd_borrowed} tUSD</i> <br />
                      Collateral Amount: {Number(collateral_amount_in_lovelace) / 1000000} ADA

                      <Button
                        className="my-4 ml-5"
                        onClick={() => handleRepayLoan(loanPosition)}
                        disabled={false}
                      >
                        Repay Loan
                      </Button>
                    </li>
                    )
                  })}
                </ol>
              </div>): (loanPositionsDisplay ? <p>You don't have any loan currently</p> : "")}
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
                Create Account/Add Deposit (Input amount in ADA)
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
        </div>) : (<p className="text-3xl">Loading... <br /> Please wait.</p>))}
      </main>
      <footer className="p-8 border-t border-gray-300 flex justify-center">
        {/* <MeshBadge isDark={true} /> */}
        <i className="text-2xl">Statera Protocol</i>
      </footer>
    </div>
  );
}
