import "server-only";
import { cache } from "react";
import { asc } from "drizzle-orm";
import { getDb, schema } from "../db";
import type { TypeDef, ModuleKey } from "../defs/types";

export const loadTypes = cache(async (): Promise<TypeDef[]> => {
  const db = await getDb();
  const rows = await db.select().from(schema.recordTypes).orderBy(asc(schema.recordTypes.sort));
  return rows.map((r) => r.def as TypeDef);
});

export async function getTypeDef(key: string): Promise<TypeDef | undefined> {
  return (await loadTypes()).find((t) => t.key === key);
}

export async function typesForModule(module: ModuleKey): Promise<TypeDef[]> {
  return (await loadTypes()).filter((t) => t.module === module);
}

export function stateOf(def: TypeDef, status: string) {
  return def.workflow.states.find((s) => s.key === status) ?? { key: status, label: status, tone: "neutral" as const };
}

export function isFinal(def: TypeDef, status: string): boolean {
  return !!def.workflow.states.find((s) => s.key === status)?.final;
}
