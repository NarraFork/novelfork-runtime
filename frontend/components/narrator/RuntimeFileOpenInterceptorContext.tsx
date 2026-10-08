import { createContext, useContext } from "react";

/** A file the narrator surface is about to open in its own file panel. */
export interface RuntimeFileOpenRequest {
	readonly filePath: string;
	readonly deviceId: string;
	/** True when the panel would show a tool edit's diff rather than the plain file. */
	readonly toolEdit: boolean;
}

/**
 * Optional host hook for embedded surfaces. Returning true means the host opened
 * the file itself (for example in a product-specific editor), so the Runtime file
 * panel is not opened. Returning false keeps the default behaviour.
 */
export type RuntimeFileOpenInterceptor = (request: RuntimeFileOpenRequest) => boolean;

const RuntimeFileOpenInterceptorContext = createContext<RuntimeFileOpenInterceptor | null>(null);

export const RuntimeFileOpenInterceptorProvider = RuntimeFileOpenInterceptorContext.Provider;

export function useRuntimeFileOpenInterceptor(): RuntimeFileOpenInterceptor | null {
	return useContext(RuntimeFileOpenInterceptorContext);
}
