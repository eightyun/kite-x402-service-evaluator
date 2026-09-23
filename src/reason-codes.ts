export const ReasonCode = {
  Unreachable: "UNREACHABLE",
  InvalidRoutePrefix: "INVALID_ROUTE_PREFIX",
  No402Response: "NO_402_RESPONSE",
  MissingPaymentRequired: "MISSING_PAYMENT_REQUIRED",
  InvalidPaymentRequired: "INVALID_PAYMENT_REQUIRED",
  InvalidX402Version: "INVALID_X402_VERSION",
  MissingAccepts: "MISSING_ACCEPTS",
  UnsupportedScheme: "UNSUPPORTED_SCHEME",
  UnsupportedNetwork: "UNSUPPORTED_NETWORK",
  UnsupportedAsset: "UNSUPPORTED_ASSET",
  InvalidPayTo: "INVALID_PAY_TO",
  InvalidAmount: "INVALID_AMOUNT",
  PriceAbovePolicy: "PRICE_ABOVE_POLICY",
  ExpectedNetworkMismatch: "EXPECTED_NETWORK_MISMATCH",
  ExpectedAssetMismatch: "EXPECTED_ASSET_MISMATCH",
  ExpectedPriceMismatch: "EXPECTED_PRICE_MISMATCH",
  InvalidEip712Domain: "INVALID_EIP712_DOMAIN",
  InvalidTimeout: "INVALID_TIMEOUT",
  UnstableEndpoint: "UNSTABLE_ENDPOINT",
  ManualReviewRequired: "MANUAL_REVIEW_REQUIRED",
} as const;

export type ReasonCodeValue = (typeof ReasonCode)[keyof typeof ReasonCode];
