export default {
  fetchUrl:
    "https://www.rsi.ch/info/natura-e-animali/Morso-di-vipera-quanto-%C3%A8-davvero-pericoloso-in-Svizzera--3837425.html",

  deleteSelectors: [
    "script",
    "meta:not([charset]):not([name=viewport])",
    'link[as="script"]',
    'link[crossorigin="use-credentials"]',
    '[data-js-plugin="dynamic-promo-banner"]',
    "[style^='display: none']",
    "noscript",
    "#config__js",
    ".c-article-body .c-article-body_item",
  ],

  insertSelectors: {
    "^.c-article-body": "{{ARTICLE_CONTENT}}",
  },

  textReplacements: {
    title: "{{ARTICLE_TITLE}}",
    ".c-article-header h1": "Titel des Artikes",
    ".c-article-credits span span":
      "Pascal Albisser, Balz Rittmeyer, Robert Salzer, Fabian Schwander",
    ".c-article-header h2":
      "Hier folgt der Lead-Text, der in der Regel eine kurze Zusammenfassung des Artikels enthält und die Aufmerksamkeit der Leser auf sich ziehen soll.",
  },
};
