/**
 * Serves FAQ submission routes for the mock data service.
 * Role: Handles POST /faq, mounted at /api.
 * Not in this file: Token helpers (src/domain/auth.js) or id generation (src/domain/identifiers.js).
 * Key dependencies: faq-answers.json via the JSON store (created on first submission).
 * See also: src/server.js.
 */

const express = require("express");
const { extractUserIdFromToken } = require("../domain/auth");
const { generateIdentifier } = require("../domain/identifiers");

/**
 * Creates the FAQ router.
 *
 * @param {{ readJsonFileWithDefault: (fileName: string, defaultValue: any) => Promise<any>, writeJsonFile: (fileName: string, data: any) => Promise<void> }} jsonStore - JSON file store bound to the data directory.
 * @returns {import("express").Router} Router with the /faq route.
 */
function createFaqRouter(jsonStore) {
  const router = express.Router();

  router.post("/faq", async (request, response) => {
    try {
      const faqPayload = request.body || {};
      const trimmedName = typeof faqPayload.name === "string" ? faqPayload.name.trim() : "";
      const trimmedEmail = typeof faqPayload.email === "string" ? faqPayload.email.trim() : "";
      const trimmedQuestion =
        typeof faqPayload.question === "string" ? faqPayload.question.trim() : "";
      const trimmedContactMethod =
        typeof faqPayload.contactMethod === "string"
          ? faqPayload.contactMethod.trim()
          : "";

      if (!trimmedName || !trimmedEmail || !trimmedQuestion) {
        response.status(400).json({
          message: "Name, email, and question are required",
        });
        return;
      }

      const userIdFromToken = extractUserIdFromToken(request.headers.authorization);
      const newFaqAnswer = {
        id: generateIdentifier("faq"),
        name: trimmedName,
        email: trimmedEmail,
        question: trimmedQuestion,
        contactMethod: trimmedContactMethod,
        submittedAt: new Date().toISOString(),
        submittedByUserId: userIdFromToken || null,
      };

      const faqAnswers = await jsonStore.readJsonFileWithDefault("faq-answers.json", []);
      faqAnswers.push(newFaqAnswer);
      await jsonStore.writeJsonFile("faq-answers.json", faqAnswers);

      response.status(201).json(newFaqAnswer);
    } catch (error) {
      response.status(500).json({
        message: "Unable to save FAQ answer",
        details: error.message,
      });
    }
  });

  return router;
}

module.exports = { createFaqRouter };
