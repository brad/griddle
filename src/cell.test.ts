// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { paintCell } from "./cell";

describe("paintCell", () => {
  it("paints a star in a finished-game gap cell", () => {
    const d = document.createElement("div");
    paintCell(d, { green: false, hints: [], letter: "", star: true });
    expect(d.className).toBe("cell gap star");
    expect(d.textContent).toBe("⭐");
  });

  it("leaves gap cells empty without a star", () => {
    const d = document.createElement("div");
    paintCell(d, { green: false, hints: [], letter: "" });
    expect(d.className).toBe("cell gap");
    expect(d.textContent).toBe("");
  });

  it("never stars a letter cell", () => {
    const d = document.createElement("div");
    paintCell(d, { green: false, hints: ["a"], letter: "x", star: true });
    expect(d.textContent).toBe("a");
    expect(d.classList.contains("star")).toBe(false);
  });
});
