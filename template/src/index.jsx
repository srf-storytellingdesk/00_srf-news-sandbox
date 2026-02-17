import React, { useEffect } from "react";
import ReactDOM from "react-dom/client";

const App = () => {
  useEffect(() => {
    document
      .querySelector("[data-news-landmark=news-loading-screen]")
      ?.remove();
  }, []);

  return (
    <div>
      <h1>SRF News Sandbox</h1>
      <p>This is a sandbox environment for SRF News widgets.</p>
    </div>
  );
};

// Uncomment next line when using i18n
//import './scripts/helpers/i18n.js'

// Careful! Leave this comment here exactly as he is: he is needed in createLanguageEmbed.mjs
/*//START
import '@Styles/srfembed.scss'
document.getElementById(name).classList.add('srfembed')
//END*/
const root = ReactDOM.createRoot(document.getElementById("srf-news-sandbox"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
