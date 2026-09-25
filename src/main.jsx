import { Buffer } from "buffer";
window.Buffer = window.Buffer || Buffer;

import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { SolanaWalletProvider } from "@/hooks/useWallet";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <SolanaWalletProvider>
        <App />
      </SolanaWalletProvider>
    </BrowserRouter>
  </React.StrictMode>
);
