import React from "react";
import ReactDOM from "react-dom/client";
import PortalApp from "./portal/PortalApp";
import "@fontsource/medula-one/latin-400.css";
import "./styles.css";
import "./portal/portal.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <PortalApp />
  </React.StrictMode>
);
