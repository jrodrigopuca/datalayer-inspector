/**
 * What element text may reach a trigger label (docs/TECH-DEBT.md, item 6).
 * Both reproductions come from the smoke test: a table cell holding an
 * account number, and a <select> wrapped in <label>Plan</label>.
 */

import { TRIGGER_TYPE } from "@shared/types";
import { beforeEach, describe, expect, it } from "vitest";
import {
  describeElement,
  resetTracker,
  resolveTrigger,
  startInteractionTracking,
} from "./interaction-tracker";

function mount(html: string): void {
  document.body.innerHTML = html;
}

function click(selector: string): void {
  const el = document.querySelector(selector);
  if (!el) throw new Error(`missing ${selector}`);
  el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

describe("describeElement privacy rules", () => {
  it("never records the text of a table cell (reproduction 1)", () => {
    mount(
      '<table><tr><td>Account</td><td id="acct">ACCT-99887766 jane.doe@example.com</td></tr></table>'
    );
    const cell = document.getElementById("acct") as Element;

    expect(describeElement(cell)).toBe("td");
  });

  it("never records the text of generic containers", () => {
    mount(
      '<div id="row"><span>Order 4711 for jane.doe@example.com</span></div>'
    );

    expect(describeElement(document.getElementById("row") as Element)).toBe(
      "div"
    );
    expect(describeElement(document.querySelector("span") as Element)).toBe(
      "span"
    );
  });

  it("describes a select by its wrapping label, not its options (reproduction 2)", () => {
    mount(
      '<label>Plan <select id="plan"><option value="free">Free</option><option value="pro" selected>Pro</option></select></label>'
    );

    expect(describeElement(document.getElementById("plan") as Element)).toBe(
      'select "Plan"'
    );
  });

  it("describes an input by its label[for], never by its value", () => {
    mount(
      '<label for="email">Email address</label><input id="email" type="email" value="jane.doe@example.com">'
    );

    expect(describeElement(document.getElementById("email") as Element)).toBe(
      'input "Email address"'
    );
  });

  it("falls back to placeholder, then name, then type for unlabeled inputs", () => {
    mount(
      '<input id="a" placeholder="Search" value="secret"><input id="b" name="zip" value="1234"><input id="c" type="password" value="hunter2">'
    );

    expect(describeElement(document.getElementById("a") as Element)).toBe(
      'input "Search"'
    );
    expect(describeElement(document.getElementById("b") as Element)).toBe(
      'input "zip"'
    );
    expect(describeElement(document.getElementById("c") as Element)).toBe(
      'input "type=password"'
    );
  });

  it("allows the caption of submit/button inputs (that value is a label)", () => {
    mount('<input id="go" type="submit" value="Send lead">');

    expect(describeElement(document.getElementById("go") as Element)).toBe(
      'input "Send lead"'
    );
  });

  it("describes a textarea by its label only", () => {
    mount(
      '<label for="msg">Message</label><textarea id="msg">my private notes</textarea>'
    );

    expect(describeElement(document.getElementById("msg") as Element)).toBe(
      'textarea "Message"'
    );
  });

  it("describes a form by name or id, never by its content", () => {
    mount(
      '<form id="lead-form"><p>Account ACCT-99887766</p><button>Send lead</button></form>'
    );

    expect(
      describeElement(document.getElementById("lead-form") as Element)
    ).toBe('form "lead-form"');
  });

  it("keeps visible text for real controls", () => {
    mount(
      '<a id="link" href="#">Account settings</a><div id="rb" role="button">Open menu</div><details><summary id="sum">More</summary></details>'
    );

    expect(describeElement(document.getElementById("link") as Element)).toBe(
      'a "Account settings"'
    );
    expect(describeElement(document.getElementById("rb") as Element)).toBe(
      'div "Open menu"'
    );
    expect(describeElement(document.getElementById("sum") as Element)).toBe(
      'summary "More"'
    );
  });

  it("always honours an explicit accessible name", () => {
    mount('<div id="x" aria-label="Close dialog">ACCT-1</div>');

    expect(describeElement(document.getElementById("x") as Element)).toBe(
      'div "Close dialog"'
    );
  });
});

describe("attribution end to end", () => {
  beforeEach(() => {
    resetTracker(Date.now());
    startInteractionTracking();
  });

  it("a click on a sensitive cell is attributed with tag and selector only", () => {
    mount(
      '<table><tr><td id="sensitive-cell">ACCT-99887766 jane.doe@example.com</td></tr></table>'
    );

    click("#sensitive-cell");
    const trigger = resolveTrigger(Date.now());

    expect(trigger.type).toBe(TRIGGER_TYPE.CLICK);
    expect(trigger.label).toBe("td");
    expect(trigger.selector).toBe("#sensitive-cell");
    expect(JSON.stringify(trigger)).not.toContain("ACCT");
  });

  it("a click on a span inside a button still yields the button text", () => {
    mount('<button id="buy"><span>Add to cart</span></button>');

    click("#buy span");
    const trigger = resolveTrigger(Date.now());

    expect(trigger.label).toBe('button "Add to cart"');
    expect(trigger.selector).toBe("#buy");
  });
});
