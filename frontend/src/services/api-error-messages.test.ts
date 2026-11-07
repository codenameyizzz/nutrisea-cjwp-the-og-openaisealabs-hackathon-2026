import assert from "node:assert/strict";
import test from "node:test";
import { ApiError, responseJson } from "../lib/api";
import { apiErrorMessage } from "../lib/api-error-messages";

test("known backend identity configuration errors display in English with their original status", async () => {
  await assert.rejects(
    responseJson(Response.json({ detail: "Verifikasi identitas belum dikonfigurasi" }, { status: 503 })),
    (error: unknown) => error instanceof ApiError && error.status === 503
      && error.message === "Identity verification has not been configured.",
  );
  assert.equal(apiErrorMessage("Silakan masuk terlebih dahulu"), "Please sign in first.");
});

test("unknown diagnostics and partial matches pass through unchanged", async () => {
  const unknown = "Migrasi menunggu persetujuan";
  await assert.rejects(responseJson(Response.json({ detail: unknown }, { status: 409 })),
    (error: unknown) => error instanceof ApiError && error.status === 409 && error.message === unknown);
  for (const message of ["Verifikasi identitas belum dikonfigurasi (diagnostic 42)", "__proto__", ""]) {
    assert.equal(apiErrorMessage(message), message);
  }
});

test("validation details translate only known messages while preserving status and success data", async () => {
  const detail = [{ msg: "Pilih maksimal tiga persona pendamping yang berbeda" }, { msg: "Value error, custom diagnostic" }, {}];
  await assert.rejects(responseJson(Response.json({ detail }, { status: 422 })),
    (error: unknown) => error instanceof ApiError && error.status === 422
      && error.message === "Select up to three distinct supporting personas.; Value error, custom diagnostic; Invalid input");
  const data = { detail: "Silakan masuk terlebih dahulu", id: "original-id" };
  assert.deepEqual(await responseJson(Response.json(data)), data);
});
