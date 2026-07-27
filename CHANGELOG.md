# Changelog

## 0.2.0

- Added `HIGGSFIELD_BASE_URL`, `HIGGSFIELD_KEY`, `HIGGSFIELD_SECRET`, and `HIGGSFIELD_CALLBACK` environment support.
- Added automatic callback injection through the `hf_webhook` query parameter.
- Added framework-neutral and Node.js webhook handlers.
- Added pluggable webhook verification, status routing, and idempotency.
- Added direct status, poll, wait, get-result, subscribe, and cancel helpers.
- Added typed model constants and inputs for the models visible in the supplied Higgsfield Cloud gallery.
- Added `generateAudio` and Qwen Audio 3.0 TTS Flash support.
- Added runtime, webhook, environment, and compile-time type tests.

## 0.1.0

- Initial TypeScript SDK.
- Added generation submission, status polling, cancellation, motions, and Soul styles.
- Added typed errors, retries, validation, and webhook parsing.
