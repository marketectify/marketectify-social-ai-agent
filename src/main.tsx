import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import BrandBar from "./components/BrandBar";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrandBar />
    <App />
  </StrictMode>
);
