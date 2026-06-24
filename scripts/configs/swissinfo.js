export default {
  fetchUrl:
    "https://www.swissinfo.ch/eng/global-trade/swiss-group-supports-gulf-oil-and-gas-repairs/91632308",

  embedTemplate: "embed_swissinfo.html",

  deleteSelectors: [
    "script",
    "meta:not([charset]):not([name=viewport])",
    'link[as="script"]',
    'link[crossorigin="use-credentials"]',
    '[data-js-plugin="dynamic-promo-banner"]',
    "[style^='display: none']",
    "noscript",
    "#config__js",
    "main article .article-main > *:not(.article-meta-list):not(.article-meta-row)",
  ],

  insertSelectors: {
    "main article .article-main": "{{ARTICLE_CONTENT}}",
  },

  textReplacements: {
    title: "{{ARTICLE_TITLE}}",
    ".article-title__overline": "Spitzmarke",
    "main article .article-header h1": "Titel des Artikes",
    ".article-authors .author__title":
      "Pascal Albisser, Balz Rittmeyer, Robert Salzer, Fabian Schwander",
    "h2.lead-text__content":
      "Hier folgt der Lead-Text, der in der Regel eine kurze Zusammenfassung des Artikels enthält und die Aufmerksamkeit der Leser auf sich ziehen soll.",
  },
};
