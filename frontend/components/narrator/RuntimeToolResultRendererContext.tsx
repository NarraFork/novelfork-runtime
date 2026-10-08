import { createContext, type ReactNode, useContext } from "react";

/** Host-owned follow-up from a product tool-result card. */
export interface RuntimeToolResultAction {
	readonly type: string;
	readonly toolName: string;
	readonly input: Readonly<Record<string, unknown>>;
}

export interface RuntimeToolResultRendererInput {
	readonly toolName: string;
	readonly renderer: string;
	readonly result: unknown;
	readonly onAction?: (
		action: RuntimeToolResultAction,
	) => Promise<unknown> | unknown;
}

/** Optional host-provided presentation for a Runtime tool result. */
export type RuntimeToolResultRenderer = (
	input: RuntimeToolResultRendererInput,
) => ReactNode;

const RuntimeToolResultRendererContext =
	createContext<RuntimeToolResultRenderer | null>(null);

export const RuntimeToolResultRendererProvider =
	RuntimeToolResultRendererContext.Provider;

export function useRuntimeToolResultRenderer(): RuntimeToolResultRenderer | null {
	return useContext(RuntimeToolResultRendererContext);
}
