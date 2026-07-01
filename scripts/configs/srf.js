export default {
  fetchUrl:
    "https://www.srf.ch/news/dialog/fehlende-berichterstattung-humanitaere-krisen-ohne-aufmerksamkeit",

  embedTemplate: "embed_default.html",

  deleteSelectors: [
    "script",
    "meta:not([charset]):not([name=viewport])",
    'link[as="script"]',
    'link[crossorigin="use-credentials"]',
    '[data-js-plugin="dynamic-promo-banner"]',
    "[style^='display: none']",
    "noscript",
    "#config__js",
  ],

  insertSelectors: {
    "^main.articlepage article": "{{TOP_MEDIA_ELEMENT}}",
  },

  textReplacements: {
    title: "{{ARTICLE_TITLE}}",
    '[data-news-landmark="article-content"]': "{{ARTICLE_CONTENT}}",
    ".article-title__overline": "Spitzmarke",
    ".article-title__text": "Titel des Artikes",
    ".article-author__name span[itemprop='name']":
      "Pascal Albisser, Balz Rittmeyer, Robert Salzer, Fabian Schwander",
    ".article-lead":
      "Hier folgt der Lead-Text, der in der Regel eine kurze Zusammenfassung des Artikels enthält und die Aufmerksamkeit der Leser auf sich ziehen soll.",
  },
};
