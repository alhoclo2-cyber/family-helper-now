import { expect, mock, test } from "bun:test";
const clientId = "11111111-1111-4111-8111-111111111111";
const otherId = "22222222-2222-4222-8222-222222222222";
const rows = Array.from({ length: 320 }, (_, index) => ({
  id: index,
  client_id: index < 160 ? clientId : otherId,
  scheduled_charge_at: new Date(Date.UTC(2026, 0, 1) + index * 60000).toISOString(),
  status: index % 2 ? "debit_echoue" : "annulee_echec_paiement"
}));
const operations = [];
const supabase = {
  rpc: async () => ({ data: true }),
  from: () => {
    let selected = [...rows];
    return {
      select: (_columns, options) => {
        if (options?.head) {
          return { in: async (_column, statuses) => ({
            count: selected.filter((row) => statuses.includes(row.status)).length,
            error: null
          }) };
        }
        const query = {
          eq: (_column, id) => {
            operations.push("filter");
            selected = selected.filter((row) => row.client_id === id);
            return query;
          },
          order: (_column, order) => {
            operations.push("order");
            expect(order).toEqual({ ascending: false, nullsFirst: false });
            selected.sort((a, b) => b.scheduled_charge_at.localeCompare(a.scheduled_charge_at));
            return query;
          },
          limit: async (limit) => {
            operations.push("limit");
            return { data: selected.slice(0, limit), error: null };
          }
        };
        return query;
      }
    };
  }
};
mock.module("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
mock.module("@tanstack/react-start", () => ({
  createServerFn: () => {
    let validate = (input) => input;
    const builder = {
      middleware: () => builder,
      inputValidator: (validator) => {
        validate = validator;
        return builder;
      },
      handler: (handler) => (args) => handler({ data: validate(args?.data), context: { supabase, userId: otherId } })
    };
    return builder;
  }
}));
const { listMissionPayments, countFailedMissionPayments } = await import("./payments.functions");
test("more than 100 payments: filter client before sorting and limiting to its latest 100", async () => {
  operations.length = 0;
  const payments = await listMissionPayments({ data: { clientId } });
  expect(operations).toEqual(["filter", "order", "limit"]);
  expect(payments?.length).toBe(100);
  expect(payments?.map((row) => row.id)).toEqual(Array.from({ length: 100 }, (_, index) => 159 - index));
  expect(payments?.every((row) => row.client_id === clientId)).toBe(true);
});
test("without a client returns the latest 100 globally and rejects invalid UUIDs", async () => {
  const payments = await listMissionPayments();
  expect(payments?.map((row) => row.id)).toEqual(Array.from({ length: 100 }, (_, index) => 319 - index));
  expect(() => listMissionPayments({ data: { clientId: "not-a-uuid" } })).toThrow();
});
test("failed payment count includes rows outside the 100-row list", async () => {
  expect(await countFailedMissionPayments()).toBe(320);
});
