import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../../db";
import { narratorMessages, narrators, userPluginThemes, users } from "../../db/schema";
import { buildAppErrorResponse } from "../../lib/app-error-response";
import { generateId } from "../../lib/id";
import { createToken } from "../../lib/auth";
import { adminRoutes } from "../admin";

const ADMIN = `admin-${generateId().slice(0, 8)}`;
const TARGET = `target-${generateId().slice(0, 8)}`;
const createdUsers: string[] = [];
const createdNarrators: string[] = [];
const createdMessages: string[] = [];
const createdThemes: string[] = [];

function appFor() {
	const app = new Hono();
	app.route("/api/admin", adminRoutes as never);
	app.onError((error, c) => buildAppErrorResponse(error, c) ?? c.json({ error: String((error as Error)?.message ?? error) }, 500));
	return app;
}

async function seedUser(id: string, role: "admin" | "user") {
	const now = new Date().toISOString();
	await db.insert(users).values({
		id,
		username: id,
		passwordHash: "x",
		role,
		createdAt: now,
		updatedAt: now,
	} as never);
	createdUsers.push(id);
}

beforeEach(async () => {
	await seedUser(ADMIN, "admin");
	await seedUser(TARGET, "user");
});

afterEach(async () => {
	if (createdThemes.length) await db.delete(userPluginThemes).where(inArray(userPluginThemes.id, createdThemes));
	if (createdMessages.length) await db.delete(narratorMessages).where(inArray(narratorMessages.id, createdMessages));
	if (createdNarrators.length) await db.delete(narrators).where(inArray(narrators.id, createdNarrators));
	if (createdUsers.length) await db.delete(users).where(inArray(users.id, createdUsers));
	createdThemes.length = 0;
	createdMessages.length = 0;
	createdNarrators.length = 0;
	createdUsers.length = 0;
});

describe("删除有数据的用户", () => {
	test("用户发过消息、编辑过消息、启用过插件主题后，管理员仍能直接删除", async () => {
		const narratorId = generateId();
		createdNarrators.push(narratorId);
		const now = new Date().toISOString();
		await db.insert(narrators).values({
			id: narratorId,
			type: "primary",
			inheritMode: "fresh",
			status: "idle",
			createdAt: now,
			updatedAt: now,
		} as never);

		const messageId = generateId();
		createdMessages.push(messageId);
		await db.insert(narratorMessages).values({
			id: messageId,
			narratorId,
			createdBy: TARGET,
			editedBy: TARGET,
			role: "user",
			contentJson: "[]",
			createdAt: now,
		} as never);

		const themeId = generateId();
		createdThemes.push(themeId);
		await db.insert(userPluginThemes).values({
			id: themeId,
			userId: TARGET,
			pluginId: "p.one",
			themeId: "dark-ink",
			enabled: true,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		} as never);

		const adminToken = await createToken(ADMIN, "admin");
		const res = await appFor().request(`/api/admin/users/${TARGET}`, {
			method: "DELETE",
			headers: { Authorization: `Bearer ${adminToken}` },
		});
		expect(res.status).toBe(200);

		const [remaining] = await db.select().from(users).where(eq(users.id, TARGET));
		expect(remaining).toBeUndefined();

		const [message] = await db.select().from(narratorMessages).where(eq(narratorMessages.id, messageId));
		expect(message).toBeTruthy();
		expect(message?.createdBy).toBeNull();
		expect(message?.editedBy).toBeNull();

		const themes = await db.select().from(userPluginThemes).where(eq(userPluginThemes.id, themeId));
		expect(themes).toHaveLength(0);
	});
});
