/**
 * api.ts — small shared helpers for route handlers.
 */
import { NextResponse } from "next/server";
import { z } from "zod";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** Parse + validate a JSON body. Returns data or a 400 response. */
export async function parseBody<T extends z.ZodTypeAny>(
  req: Request,
  schema: T,
): Promise<
  { ok: true; data: z.infer<T> } | { ok: false; response: NextResponse }
> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { ok: false, response: jsonError("Invalid JSON body") };
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Validation failed", issues: result.error.flatten() },
        { status: 422 },
      ),
    };
  }
  return { ok: true, data: result.data };
}

export const genId = () => crypto.randomUUID();

/** JSON-serialise rows that contain bigint (paise) values -> strings. */
export function serializeBigInt<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_k, v) =>
      typeof v === "bigint" ? v.toString() : v,
    ),
  );
}
