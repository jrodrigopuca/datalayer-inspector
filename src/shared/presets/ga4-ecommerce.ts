/**
 * Built-in GA4 Enhanced Ecommerce schema presets
 *
 * One-click validation against Google's recommended ecommerce events,
 * so analysts don't have to hand-write @placeholder templates.
 *
 * Field requirements follow the GA4 reference:
 * https://developers.google.com/analytics/devguides/collection/ga4/reference/events
 * Note: GA4 requires item_id OR item_name; since the template language
 * can't express OR, both are optional here and the array shape is enforced.
 */

import type { CreateSchemaInput, TemplateObject } from "../types";

/** Common shape for a GA4 ecommerce item */
const GA4_ITEM: TemplateObject = {
  item_id: "@string?",
  item_name: "@string?",
  price: "@number?",
  quantity: "@number?",
  item_brand: "@string?",
  item_category: "@string?",
  item_variant: "@string?",
  discount: "@number?",
};

/** Ecommerce payload with value/currency (currency required when value is set) */
function ecommerceWith(extra: TemplateObject): TemplateObject {
  return {
    currency: "@string",
    value: "@number",
    items: [GA4_ITEM],
    ...extra,
  };
}

export const GA4_ECOMMERCE_PRESETS: readonly CreateSchemaInput[] = [
  {
    name: "GA4 · view_item_list",
    description: "User viewed a list of items (GA4 preset)",
    template: {
      event: "view_item_list",
      ecommerce: {
        item_list_id: "@string?",
        item_list_name: "@string?",
        items: [GA4_ITEM],
      },
    },
  },
  {
    name: "GA4 · select_item",
    description: "User selected an item from a list (GA4 preset)",
    template: {
      event: "select_item",
      ecommerce: {
        item_list_id: "@string?",
        item_list_name: "@string?",
        items: [GA4_ITEM],
      },
    },
  },
  {
    name: "GA4 · view_item",
    description: "User viewed item details (GA4 preset)",
    template: {
      event: "view_item",
      ecommerce: ecommerceWith({}),
    },
  },
  {
    name: "GA4 · add_to_cart",
    description: "User added items to the cart (GA4 preset)",
    template: {
      event: "add_to_cart",
      ecommerce: ecommerceWith({}),
    },
  },
  {
    name: "GA4 · remove_from_cart",
    description: "User removed items from the cart (GA4 preset)",
    template: {
      event: "remove_from_cart",
      ecommerce: ecommerceWith({}),
    },
  },
  {
    name: "GA4 · view_cart",
    description: "User viewed their cart (GA4 preset)",
    template: {
      event: "view_cart",
      ecommerce: ecommerceWith({}),
    },
  },
  {
    name: "GA4 · begin_checkout",
    description: "User began checkout (GA4 preset)",
    template: {
      event: "begin_checkout",
      ecommerce: ecommerceWith({
        coupon: "@string?",
      }),
    },
  },
  {
    name: "GA4 · add_shipping_info",
    description: "User submitted shipping info (GA4 preset)",
    template: {
      event: "add_shipping_info",
      ecommerce: ecommerceWith({
        coupon: "@string?",
        shipping_tier: "@string?",
      }),
    },
  },
  {
    name: "GA4 · add_payment_info",
    description: "User submitted payment info (GA4 preset)",
    template: {
      event: "add_payment_info",
      ecommerce: ecommerceWith({
        coupon: "@string?",
        payment_type: "@string?",
      }),
    },
  },
  {
    name: "GA4 · purchase",
    description: "User completed a purchase (GA4 preset)",
    template: {
      event: "purchase",
      ecommerce: ecommerceWith({
        transaction_id: "@string",
        tax: "@number?",
        shipping: "@number?",
        coupon: "@string?",
      }),
    },
  },
  {
    name: "GA4 · refund",
    description: "Order was refunded (GA4 preset)",
    template: {
      event: "refund",
      ecommerce: {
        transaction_id: "@string",
        currency: "@string?",
        value: "@number?",
        items: "@array?",
      },
    },
  },
] as const;
