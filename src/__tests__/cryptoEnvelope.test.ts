import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { decryptText, encryptText } from "../utils/cryptoEnvelope.js";

describe("crypto envelope", () => {
  it("round trips text", async () => {
    const plaintext = "nullid-test-payload";
    const passphrase = "strong passphrase";
    const blob = await encryptText(passphrase, plaintext);
    const decrypted = await decryptText(passphrase, blob);
    assert.equal(decrypted, plaintext);
  });

  it("fails with wrong passphrase", async () => {
    const blob = await encryptText("right", "data");
    await assert.rejects(() => decryptText("wrong", blob));
  });
});
