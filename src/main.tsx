import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { ZukkaProvider } from "./state/ZukkaContext";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ZukkaProvider>
      <App />
    </ZukkaProvider>
  </React.StrictMode>
);
