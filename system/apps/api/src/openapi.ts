// OpenAPI document generated from the shared Zod schemas. Served at /api/v1/openapi.json.
import { OpenAPIRegistry, OpenApiGeneratorV31, extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { apiErrorSchema, meSchema, totpCodeSchema } from "@proofpocket/shared";
import { z } from "zod";

extendZodWithOpenApi(z);

export function buildOpenApi() {
  const reg = new OpenAPIRegistry();
  const bearer = reg.registerComponent("securitySchemes", "firebase", { type: "http", scheme: "bearer", bearerFormat: "Firebase ID token" });
  const error = { description: "Error", content: { "application/json": { schema: apiErrorSchema } } };
  const json = <T extends z.ZodTypeAny>(schema: T) => ({ content: { "application/json": { schema } } });

  reg.registerPath({ method: "get", path: "/health", summary: "Liveness check", responses: { 200: { description: "OK", ...json(z.object({ ok: z.boolean() })) } } });
  reg.registerPath({
    method: "get", path: "/me", summary: "The signed-in user", security: [{ [bearer.name]: [] }],
    responses: { 200: { description: "Me", ...json(meSchema) }, 401: error, 403: error },
  });
  for (const [path, summary] of [["/auth/totp/activate", "Finish Google Authenticator set-up"], ["/auth/totp/verify", "Enter the Google Authenticator code after the password"], ["/auth/totp/disable", "Turn off two-step sign-in (founders)"]] as const) {
    reg.registerPath({
      method: "post", path, summary, security: [{ [bearer.name]: [] }],
      request: { body: json(totpCodeSchema) },
      responses: { 200: { description: "OK", ...json(z.object({ ok: z.boolean() })) }, 400: error, 429: error },
    });
  }
  reg.registerPath({
    method: "post", path: "/auth/totp/setup", summary: "Start Google Authenticator set-up", security: [{ [bearer.name]: [] }],
    responses: { 200: { description: "Secret and QR link", ...json(z.object({ secret: z.string(), otpauthUri: z.string() })) }, 409: error },
  });

  return new OpenApiGeneratorV31(reg.definitions).generateDocument({
    openapi: "3.1.0",
    info: { title: "ProofPocket API", version: "1" },
    servers: [{ url: "/api/v1" }],
  });
}
