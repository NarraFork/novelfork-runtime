import { describe, expect, test } from "bun:test";
import type { ComponentType } from "react";
import {
	findSettingsHostPage,
	type SettingsHostExtension,
	settingsHostPagePath,
	visibleSettingsHostGroups,
} from "./settings-host-extension";

const Icon = (() => null) as unknown as ComponentType<{ size?: number | string }>;
const Body = (() => null) as unknown as ComponentType;

const extension: SettingsHostExtension = {
	groups: [
		{
			id: "novel",
			label: "小说",
			pages: [
				{ id: "embedding", label: "向量模型", Icon, Component: Body },
				{ id: "audit", label: "审计", Icon, Component: Body, adminOnly: true },
			],
		},
		{
			id: "admin-only",
			label: "仅管理员",
			pages: [{ id: "secret", label: "机密", Icon, Component: Body, adminOnly: true }],
		},
	],
};

describe("visibleSettingsHostGroups", () => {
	test("管理员看到全部页面与分组", () => {
		const groups = visibleSettingsHostGroups(extension, true);
		expect(groups.map((group) => group.id)).toEqual(["novel", "admin-only"]);
		expect(groups[0]!.pages.map((page) => page.id)).toEqual(["embedding", "audit"]);
	});

	test("普通用户看不到 adminOnly 页面，全为 adminOnly 的分组整组消失", () => {
		const groups = visibleSettingsHostGroups(extension, false);
		expect(groups.map((group) => group.id)).toEqual(["novel"]);
		expect(groups[0]!.pages.map((page) => page.id)).toEqual(["embedding"]);
	});

	test("没有扩展（独立运行 Runtime）时没有任何分组", () => {
		expect(visibleSettingsHostGroups(null, true)).toEqual([]);
		expect(visibleSettingsHostGroups(null, false)).toEqual([]);
	});

	test("不修改原始扩展对象", () => {
		visibleSettingsHostGroups(extension, false);
		expect(extension.groups![0]!.pages).toHaveLength(2);
	});
});

describe("findSettingsHostPage", () => {
	test("按 id 找到页面，跨分组查找", () => {
		expect(findSettingsHostPage(extension, "secret")?.label).toBe("机密");
		expect(findSettingsHostPage(extension, "embedding")?.label).toBe("向量模型");
	});

	test("未知 id 或无扩展返回 undefined", () => {
		expect(findSettingsHostPage(extension, "nope")).toBeUndefined();
		expect(findSettingsHostPage(null, "embedding")).toBeUndefined();
	});
});

describe("宿主替换字段的契约", () => {
	test("只声明 About 时其它替换字段保持未设置，外观与插件主题不受影响", () => {
		const aboutOnly: SettingsHostExtension = { About: Body };
		expect(aboutOnly.About).toBe(Body);
		expect(aboutOnly.AppearanceSection).toBeUndefined();
		expect(aboutOnly.hidePluginThemes).toBeUndefined();
		expect(visibleSettingsHostGroups(aboutOnly, true)).toEqual([]);
	});

	test("独立运行 Runtime（无扩展）时没有任何替换，页面保持原样", () => {
		const standalone = null as SettingsHostExtension | null;
		expect(standalone === null ? undefined : standalone.About).toBeUndefined();
		expect(standalone === null ? undefined : standalone.hidePluginThemes).toBeUndefined();
	});
});

describe("settingsHostPagePath", () => {
	test("页面地址固定在 /settings/host/ 下，与 Runtime 原生子路径不冲突", () => {
		expect(settingsHostPagePath("embedding")).toBe("/settings/host/embedding");
	});
});
