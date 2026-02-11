/**
 * Browser Console Script: Extract all CSS rules from dark mode media queries
 *
 * Usage: Copy and paste this entire script into your browser's console
 *
 * This script scans all loaded stylesheets and extracts CSS rules that are
 * specifically defined within @media queries for dark mode, such as:
 * - @media (prefers-color-scheme: dark)
 * - @media (prefers-color-scheme: dark) and (...)
 */

(function () {
  // Iterate through all stylesheets
  console.log("🔍 Scanning stylesheets for dark mode rules...\n");

  try {
    const darkModeRules = [];
    for (let i = 0; i < document.styleSheets.length; i++) {
      const sheet = document.styleSheets[i];

      try {
        const rules = sheet.cssRules || sheet.rules;
        if (!rules) continue;

        const sheetHref = sheet.href || "inline-style";
        let foundInSheet = false;

        for (let j = 0; j < rules.length; j++) {
          const rule = rules[j];

          // Check if this is a media rule
          if (
            rule.type === CSSRule.MEDIA_RULE &&
            isDarkModeMedia(rule.media.mediaText)
          ) {
            if (!foundInSheet) {
              console.log(`\n📄 Stylesheet: ${sheetHref}`);
              foundInSheet = true;
            }

            console.log(`\n  📱 Media Query: ${rule.media.mediaText}`);

            // Extract all rules within this media query
            const mediaRules = rule.cssRules || rule.rules;
            if (mediaRules) {
              for (let k = 0; k < mediaRules.length; k++) {
                const innerRule = mediaRules[k];

                // Handle nested rules (like @supports within @media)
                if (
                  innerRule.type === CSSRule.SUPPORTS_RULE ||
                  innerRule.type === CSSRule.MEDIA_RULE
                ) {
                  const nestedRules = innerRule.cssRules || innerRule.rules;
                  if (nestedRules) {
                    for (let l = 0; l < nestedRules.length; l++) {
                      const ruleInfo = extractRules(
                        nestedRules[l],
                        rule.media.mediaText,
                      );
                      if (ruleInfo) {
                        darkModeRules.push({
                          ...ruleInfo,
                          stylesheet: sheetHref,
                          nested: innerRule.cssText.substring(0, 50) + "...",
                        });
                      }
                    }
                  }
                } else {
                  const ruleInfo = extractRules(
                    innerRule,
                    rule.media.mediaText,
                  );
                  if (ruleInfo) {
                    darkModeRules.push({
                      ...ruleInfo,
                      stylesheet: sheetHref,
                    });
                    console.log(`    ✓ ${ruleInfo.selector}`);
                  }
                }
              }
            }
          }
        }
      } catch (e) {
        // CORS or other errors accessing external stylesheets
        console.warn(
          `⚠️  Could not access stylesheet: ${sheet.href || "inline"}`,
          e.message,
        );
      }
    }

    // console.log('\n\n═══════════════════════════════════════════════════');
    // console.log(`📊 SUMMARY: Found ${darkModeRules.length} dark mode CSS rules`);
    // console.log('═══════════════════════════════════════════════════\n');

    // Group by selector for easier analysis
    const groupedBySelector = {};
    darkModeRules.forEach((rule) => {
      if (!groupedBySelector[rule.selector]) {
        groupedBySelector[rule.selector] = [];
      }
      groupedBySelector[rule.selector].push(rule);
    });

    // console.log('📋 Rules grouped by selector:');
    // console.table(
    //   Object.keys(groupedBySelector).map(selector => ({
    //     selector: selector,
    //     occurrences: groupedBySelector[selector].length,
    //     properties: Object.keys(groupedBySelector[selector][0].styles).join(', ')
    //   }))
    // );

    // Generate stylesheet string for dark mode
    // Convert color values to hex if possible

    let stylesheetString = "";
    // Group by media query
    const mediaGroups = {};
    darkModeRules.forEach((rule) => {
      if (!mediaGroups[rule.media]) mediaGroups[rule.media] = [];
      mediaGroups[rule.media].push(rule);
    });
    Object.keys(mediaGroups).forEach((media) => {
      // Sort rules by selector alphabetically
      // Merge styles for selectors with the same name
      const mergedBySelector = {};
      mediaGroups[media].forEach((rule) => {
        if (!mergedBySelector[rule.selector]) {
          mergedBySelector[rule.selector] = {
            ...rule,
            styles: { ...rule.styles },
          };
        } else {
          // Merge styles (later rules override earlier ones)
          Object.assign(mergedBySelector[rule.selector].styles, rule.styles);
        }
      });

      // Custom sort: :root first, then elements, then classes
      function selectorRank(sel) {
        if (sel.startsWith(":root")) return 0;
        if (/^\#[\w-]/.test(sel)) return 2; // id selectors
        if (/^\.[\w-]/.test(sel)) return 3; // class selectors
        return 1; // element selectors
      }
      // Extract and merge :root and body styles
      const rootStyles = mergedBySelector[":root"]
        ? { ...mergedBySelector[":root"].styles }
        : {};
      const bodyStyles = mergedBySelector["body"]
        ? { ...mergedBySelector["body"].styles }
        : {};

      // Remove :root and body from output
      delete mergedBySelector[":root"];
      delete mergedBySelector["body"];

      const sortedSelectors = Object.keys(mergedBySelector).sort((a, b) => {
        const rankA = selectorRank(a);
        const rankB = selectorRank(b);
        if (rankA !== rankB) return rankA - rankB;
        if (a < b) return -1;
        if (a > b) return 1;
        return 0;
      });

      stylesheetString += `body[data-theme] {\n`;
      stylesheetString += toCSS(
        { selector: ":root", styles: rootStyles },
        true,
      );
      stylesheetString += toCSS({ selector: "body", styles: bodyStyles }, true);
      // Output other selectors, excluding :root and body which are merged into the top-level
      sortedSelectors.forEach((selector) => {
        stylesheetString += toCSS(mergedBySelector[selector]);
      });
      stylesheetString += "}\n\n";
    });

    // Output stylesheet string
    console.log("\n🎨 Usable stylesheet string for dark mode:");
    console.log(stylesheetString);
    return stylesheetString;
  } catch (error) {
    console.error("❌ Error scanning stylesheets:", error);
    return [];
  }
})();
