export default {
  fetchUrl:
    "https://www.rts.ch/info/regions/vaud/2026/article/gale-dans-la-broye-les-cas-confirmes-sont-rares-dans-le-canton-de-vaud-29283692.html",

  embedTemplate: "embed_rts.html",

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
    "^main[data-zone-id='content'] article": "{{TOP_MEDIA_ELEMENT}}",
  },

  textReplacements: {
    title: "{{ARTICLE_TITLE}}",
    '[data-area-id="article-content"] .article-body': "{{ARTICLE_CONTENT}}",
    ".article-category": "Spitzmarke",
    ".article-title": "Titel des Artikes",
    ".article-lead":
      "Hier folgt der Lead-Text, der in der Regel eine kurze Zusammenfassung des Artikels enthält und die Aufmerksamkeit der Leser auf sich ziehen soll.",
  },
};
