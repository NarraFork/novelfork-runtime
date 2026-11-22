/**
 * Host hooks into `server/serve.ts` startup (NovelFork fork layer).
 *
 * An embedding host (a product executable that imports `server/index.ts`) registers these before
 * importing the server, to take part in startup without patching it:
 *
 * - `beforeServerMain` runs inside the startup error boundary after the status page is up and
 *   before `./main` loads. Work that opens the database (registering a product integration whose
 *   imports reach `server/db`) belongs here, so the page shows the upgrade and a failure is reported
 *   on it instead of escaping before there is a page.
 * - `onStartupPageListening` / `onServerListening` say where a browser can reach the app, as early
 *   as there is something to show. A host that opens its own window returns `true` from the first
 *   to say a viewer is coming, so a failed start waits for the page to read why.
 * - `onInstanceLocked` gets a start that lost the instance lock; returning `true` means the host
 *   brought the running instance forward and this process exits 0.
 *
 * Product-neutral and dependency-free: a standalone Runtime registers nothing and starts exactly as
 * upstream does. Pinned to `globalThis` so the host and the server graph see one registry even when
 * a module is evaluated twice (hot reload, duplicated specifiers).
 */

export interface RuntimeInstanceLockedInfo {
	/** Pid recorded by the instance lock holder. */
	readonly pid: number;
}

export interface RuntimeStartupHooks {
	beforeServerMain?(): void | Promise<void>;
	/** `url` is the configured address the status page answers on. Return whether a viewer opens. */
	onStartupPageListening?(url: string): boolean | undefined;
	/** `url` is the browser-facing origin of the real server, after it bound its listener. */
	onServerListening?(url: string): void;
	onInstanceLocked?(info: RuntimeInstanceLockedInfo): boolean | Promise<boolean>;
}

const HOOKS_KEY = Symbol.for("narrafork.runtimeStartupHooks.v1");
const registry = globalThis as { [HOOKS_KEY]?: RuntimeStartupHooks };

/** Register the host's startup hooks. A later call replaces the earlier set. */
export function registerRuntimeStartupHooks(hooks: RuntimeStartupHooks): void {
	registry[HOOKS_KEY] = hooks;
}

export function getRuntimeStartupHooks(): RuntimeStartupHooks {
	return registry[HOOKS_KEY] ?? {};
}

/** Test-only reset. */
export function resetRuntimeStartupHooksForTests(): void {
	delete registry[HOOKS_KEY];
}

/**
 * Call a notification hook without letting the host break startup: a throwing window opener must
 * not cost the server its start. Returns the hook's result, or `undefined` when it threw.
 */
export function notifyStartupHook<A extends unknown[], R>(
	hook: ((...args: A) => R) | undefined,
	...args: A
): R | undefined {
	if (!hook) return undefined;
	try {
		return hook(...args);
	} catch (error) {
		console.warn(`[startup-hooks] host hook failed: ${String(error)}`);
		return undefined;
	}
}
