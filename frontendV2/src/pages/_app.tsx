import "@/styles/globals.css";
import "@meshsdk/react/styles.css";
import type { AppProps } from "next/app";
import { MeshProvider } from "@meshsdk/react";
import { WalletConnectionProvider } from "@/components/WalletConnectionContext";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <MeshProvider>
      <WalletConnectionProvider>
        <Component {...pageProps} />
      </WalletConnectionProvider>
    </MeshProvider>
  );
}
