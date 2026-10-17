import { type ComponentType, createContext, type ReactNode, useContext } from "react";

/**
 * Product-host extension of the settings page (NovelFork fork layer).
 *
 * A product that embeds the native settings page (`EmbeddedRuntimePageHost`) may add
 * its own settings to the SAME sidebar instead of stacking a second navigation on top
 * of it: two nav layers made users guess which one owned a setting, and let the host's
 * tabs collide with Runtime entries of the same name ("外观与界面", "关于").
 *
 * - `groups`: extra sidebar groups, rendered after the Runtime groups. Each page lives
 *   at `/settings/host/<id>` and is rendered by the host-supplied component.
 * - `appearanceSection`: extra content rendered at the top of the Runtime appearance
 *   page (the product's own themes), so there is one appearance page, not two.
 * - `hidePluginThemes`: the product owns the color system; a second theme picker would
 *   fight it.
 * - `about`: replaces the Runtime about page body with the product's.
 *
 * Standalone Runtime has no provider, so every field is absent and nothing changes.
 */
export interface SettingsHostPage {
	/** URL segment under /settings/host/; [a-z0-9-]+. */
	readonly id: string;
	readonly label: string;
	readonly Icon: ComponentType<{ size?: number | string }>;
	readonly Component: ComponentType;
	/** Hide from non-admins and redirect them away, like Runtime instance pages. */
	readonly adminOnly?: boolean;
}

export interface SettingsHostGroup {
	readonly id: string;
	readonly label: string;
	readonly pages: readonly SettingsHostPage[];
}

export interface SettingsHostExtension {
	readonly groups?: readonly SettingsHostGroup[];
	/** 宿主（插件）贡献、可供自定义子代理勾选的额外工具名；编辑器在通用工具后列出。 */
	readonly subagentTools?: readonly string[];
	readonly AppearanceSection?: ComponentType;
	readonly hidePluginThemes?: boolean;
	readonly About?: ComponentType;
}

export const SETTINGS_HOST_PAGE_PREFIX = "/settings/host/";

const SettingsHostExtensionContext = createContext<SettingsHostExtension | null>(null);

export function SettingsHostExtensionProvider({
	value,
	children,
}: {
	readonly value: SettingsHostExtension | null | undefined;
	readonly children: ReactNode;
}): ReactNode {
	return (
		<SettingsHostExtensionContext.Provider value={value ?? null}>
			{children}
		</SettingsHostExtensionContext.Provider>
	);
}

export function useSettingsHostExtension(): SettingsHostExtension | null {
	return useContext(SettingsHostExtensionContext);
}

export function settingsHostPagePath(id: string): string {
	return `${SETTINGS_HOST_PAGE_PREFIX}${id}`;
}

/** Host groups with admin-only pages removed for non-admins; empty groups dropped. */
export function visibleSettingsHostGroups(
	extension: SettingsHostExtension | null,
	isAdmin: boolean,
): readonly SettingsHostGroup[] {
	const groups = extension?.groups ?? [];
	return groups
		.map((group) => ({
			...group,
			pages: group.pages.filter((page) => isAdmin || !page.adminOnly),
		}))
		.filter((group) => group.pages.length > 0);
}

export function findSettingsHostPage(
	extension: SettingsHostExtension | null,
	id: string,
): SettingsHostPage | undefined {
	for (const group of extension?.groups ?? []) {
		const page = group.pages.find((candidate) => candidate.id === id);
		if (page) return page;
	}
	return undefined;
}
