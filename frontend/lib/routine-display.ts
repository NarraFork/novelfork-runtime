import { pickLocalizedValue } from "@shared/i18n-locales";

/**
 * Display name of a routine row. Product-contributed routines declare localized
 * names (`nameEn` / `nameZh`); built-ins fall back to their tool / command / skill
 * name, which is what the row always showed.
 */
export function routineDisplayName(
	routine: { name: string; nameEn?: string; nameZh?: string },
	locale: string | null | undefined,
): string {
	if (!routine.nameEn) return routine.name;
	return pickLocalizedValue(
		{ en: routine.nameEn, "zh-CN": routine.nameZh ?? routine.nameEn },
		locale,
	);
}
