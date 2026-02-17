import { describe, it, expect } from "vitest";
import { pointAssetUrlsToSandbox } from "./file-helper.js";
import { getDefinedClasses, removeUnusedClasses } from "./file-helper.js";

describe("file-helper", () => {
  describe("getDefinedClasses", () => {
    it("extracts class names from formatted CSS", () => {
      const css = `.foo { color: red; } .bar { color: blue; }`;
      expect(getDefinedClasses(css)).toEqual(new Set(["foo", "bar"]));
    });
    it("extracts class names from minified CSS", () => {
      const css = `.foo{color:red;}.bar{color:blue;}`;
      expect(getDefinedClasses(css)).toEqual(new Set(["foo", "bar"]));
    });
    it("extracts class names with elements", () => {
      const css = `div.foo{color:red;} span.bar{color:blue;}`;
      expect(getDefinedClasses(css)).toEqual(new Set(["foo", "bar"]));
    });
    // it("ignores class names in comments", () => {
    //   const css = `/* .baz { color: green; } */ .foo {}`;
    //   expect(getDefinedClasses(css)).toEqual(new Set(["foo"]));
    // });
    it("handles empty CSS", () => {
      expect(getDefinedClasses("")).toEqual(new Set());
    });
  });

  describe("removeUnusedClasses", () => {
    it("removes unused class definitions", () => {
      const css = `.foo { color: red; } .bar { color: blue; }`;
      const used = new Set(["foo"]);
      expect(removeUnusedClasses(css, used)).toContain(".foo");
      expect(removeUnusedClasses(css, used)).not.toContain(".bar");
    });
    it("removes minified unused class definitions", () => {
      const css = `.foo{color:red;}.bar{color:blue;}`;
      const used = new Set(["bar"]);
      expect(removeUnusedClasses(css, used)).toContain(".bar");
      expect(removeUnusedClasses(css, used)).not.toContain(".foo");
    });
    it("removes class names with elements", () => {
      const css = `div.foo{color:red;} span.bar{color:blue;}`;
      const used = new Set(["bar"]);
      expect(removeUnusedClasses(css, used)).toContain("span.bar");
      expect(removeUnusedClasses(css, used)).not.toContain("div.foo");
      expect(removeUnusedClasses(css, used)).not.toContain("div.something");
    });
    // it("does not remove classes in comments", () => {
    //   const css = `/* .foo { color: red; } */ .bar { color: blue; }`;
    //   const used = new Set();
    //   // .foo is in comment, .bar is removed
    //   const result = removeUnusedClasses(css, used);
    //   expect(result).toContain(".foo");
    //   expect(result).not.toContain(".bar");
    // });
    it("returns unchanged CSS if all classes are used", () => {
      const css = `.foo { color: red; }`;
      const used = new Set(["foo"]);
      expect(removeUnusedClasses(css, used)).toBe(css);
    });
    it("handles empty CSS", () => {
      expect(removeUnusedClasses("", new Set(["foo"]))).toBe("");
    });
  });
  it("pointAssetUrlsToSandbox rewrites asset URLs in HTML", () => {
    const input =
      '<img src="/foo/bar.png" /> <script src="/deep/nested/file.js"></script>';
    const expected =
      '<img src="../sandbox-assets/foo/bar.png" /> <script src="../sandbox-assets/deep/nested/file.js"></script>';
    expect(pointAssetUrlsToSandbox(input)).toBe(expected);
  });

  it("pointCssAssetUrlsToSandbox rewrites asset URLs in CSS (with quotes)", () => {
    const input =
      "background: url('/foo/bar.png'); background: url(\"/deep/nested/file.woff2\");";
    const expected =
      "background: url('../sandbox-assets/foo/bar.png'); background: url(\"../sandbox-assets/deep/nested/file.woff2\");";
    expect(pointAssetUrlsToSandbox(input)).toBe(expected);
  });

  it("pointAssetUrlsToSandbox rewrites asset URLs in CSS (without quotes)", () => {
    const input =
      "background: url(/foo/bar.png); background: url(/deep/nested/file.woff2);";
    const expected =
      "background: url(../sandbox-assets/foo/bar.png); background: url(../sandbox-assets/deep/nested/file.woff2);";
    expect(pointAssetUrlsToSandbox(input)).toBe(expected);
  });

  // it("pointAssetUrlsToSandbox should not rewrite already sandboxed URLs", () => {
  //   const input =
  //     '<img src="./sandbox-assets/foo/bar.png" /> <script src="./sandbox-assets/deep/nested/file.js"></script>';
  //   const expected =
  //     '<img src="./sandbox-assets/foo/bar.png" /> <script src="/sandbox-assets/deep/nested/file.js"></script>';
  //   expect(pointAssetUrlsToSandbox(input)).toBe(expected);
  // });
});
