/**
 * Test code generator types
 */

/** Supported test frameworks */
export const TEST_FRAMEWORK = {
  PLAYWRIGHT: "playwright",
  CYPRESS: "cypress",
} as const;

export type TestFramework = (typeof TEST_FRAMEWORK)[keyof typeof TEST_FRAMEWORK];

/** Assertion style for generated tests */
export const ASSERTION_STYLE = {
  /** Match exact values from captured event */
  EXACT: "exact",
  /** Use type matchers (expect.any(String), etc.) */
  TYPE_ONLY: "type-only",
} as const;

export type AssertionStyle = (typeof ASSERTION_STYLE)[keyof typeof ASSERTION_STYLE];

/** Options for test generation */
export interface TestGeneratorOptions {
  /** Target test framework */
  framework: TestFramework;
  /** How to assert values */
  assertionStyle: AssertionStyle;
  /** Include page.goto() / cy.visit() with URL */
  includeNavigation: boolean;
  /** Include wait/timeout for SPA navigation */
  includeWaits: boolean;
  /** Test description/name */
  testName: string;
  /** URL for navigation (if includeNavigation is true) */
  url?: string;
}

/** Result of test generation */
export interface GeneratedTest {
  /** The generated code */
  code: string;
  /** Suggested filename */
  filename: string;
  /** Framework used */
  framework: TestFramework;
}
