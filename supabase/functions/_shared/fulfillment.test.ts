import { assertEquals, assertThrows } from "https://deno.land/std@0.190.0/testing/asserts.ts"
import { computeSubscriptionPeriod, resolveEnrollments } from "./fulfillment.ts"
import { getPublicSupabaseUrl, isInternalDockerUrl } from "./supabase.ts"

const envOf = (vars: Record<string, string>) => (key: string) => vars[key]

Deno.test("getPublicSupabaseUrl prioriza SUPABASE_PUBLIC_URL", () => {
  const url = getPublicSupabaseUrl(envOf({
    SUPABASE_URL: "http://kong:8000",
    SUPABASE_PUBLIC_URL: "https://api.example.com/",
  }))
  assertEquals(url, "https://api.example.com")
})

Deno.test("getPublicSupabaseUrl usa SUPABASE_URL si es pública", () => {
  assertEquals(getPublicSupabaseUrl(envOf({ SUPABASE_URL: "https://x.supabase.co" })), "https://x.supabase.co")
})

Deno.test("getPublicSupabaseUrl falla si solo hay URL interna", () => {
  assertThrows(() => getPublicSupabaseUrl(envOf({ SUPABASE_URL: "http://kong:8000" })))
})

Deno.test("isInternalDockerUrl detecta URLs internas", () => {
  assertEquals(isInternalDockerUrl("http://kong:8000"), true)
  assertEquals(isInternalDockerUrl("https://api.cohablosandes.cloud"), false)
})

Deno.test("computeSubscriptionPeriod sin suscripción activa parte hoy", () => {
  const now = new Date("2026-01-15T12:00:00Z")
  assertEquals(computeSubscriptionPeriod(null, 1, now), { start_date: "2026-01-15", end_date: "2026-02-15" })
})

Deno.test("computeSubscriptionPeriod encadena con suscripción vigente", () => {
  const now = new Date("2026-01-15T12:00:00Z")
  assertEquals(
    computeSubscriptionPeriod("2026-02-01", 3, now),
    { start_date: "2026-02-01", end_date: "2026-05-01" },
  )
})

Deno.test("computeSubscriptionPeriod ignora suscripción vencida", () => {
  const now = new Date("2026-03-10T12:00:00Z")
  assertEquals(computeSubscriptionPeriod("2026-02-01", 1, now).start_date, "2026-03-10")
})

Deno.test("resolveEnrollments mapea 'main' al pagador y omite vacíos", () => {
  const result = resolveEnrollments({
    main: [{ serviceId: "bjj" }],
    "kid-1": [{ id: "kids" }],
    "kid-2": [],
  }, "payer-123")
  assertEquals(result, [
    { personId: "payer-123", serviceIds: ["bjj"] },
    { personId: "kid-1", serviceIds: ["kids"] },
  ])
})
