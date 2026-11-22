/**
 * 嵌入宿主对 Windows 管理器的定制（NovelFork fork 层）。
 *
 * 产品可执行文件（import `server/index.ts` 的宿主）在进入管理器之前注册：产品名替换面板里
 * 的 "NarraFork"，单实例互斥体与窗口标题按产品区分（同机还开着独立 NarraFork 时互不抢占），
 * 窗口/托盘图标用产品自己的，「打开前端」交给宿主的产品窗口（含聚焦已开窗口）。
 *
 * 不注册时一切按上游行为。零依赖，挂在 `globalThis` 上，模块被重复求值时也只有一份。
 */

export interface ManagerFrontendRequest {
	/** 服务地址（面板观测到的实际监听地址）。 */
	readonly url: string;
	/** 服务启动后的自动打开；否则是人主动要求（托盘双击、按钮、再次启动）。 */
	readonly automatic: boolean;
	/** Shift+点击「打开」：强制新开窗口，不聚焦已有窗口。 */
	readonly forceNewWindow: boolean;
	/** 实例显示名（前端页面标题），用于查找已开窗口。 */
	readonly windowTitle: string;
}

export interface ManagerHost {
	/** 面板文案、窗口标题、托盘提示里的产品名。 */
	readonly productName: string;
	/**
	 * 单实例互斥体与窗口标题的产品键（如 "NovelFork"），同一产品的新旧版本必须一致：
	 * 更新后新面板按它找到旧面板并请其让位。
	 */
	readonly instanceKey: string;
	/** 方形 RGBA 图标像素（size×size×4），用作窗口与托盘图标；拿不到返回 undefined。 */
	icon?(size: number): Uint8Array | undefined;
	/**
	 * 打开（或聚焦）产品窗口。注册后面板不再读 `server.openBrowser`：何时、如何打开由宿主决定。
	 * 返回实际结果，仅用于日志。
	 */
	openFrontend?(request: ManagerFrontendRequest): "focused" | "opened" | "none";
	/** 源码运行时拉起服务子进程的参数（编译产物始终是 `--serve`）。 */
	readonly sourceServeArgs?: readonly string[];
}

const HOST_KEY = Symbol.for("narrafork.managerHost.v1");
const registry = globalThis as { [HOST_KEY]?: ManagerHost };

export function registerManagerHost(host: ManagerHost): void {
	registry[HOST_KEY] = host;
}

export function getManagerHost(): ManagerHost | undefined {
	return registry[HOST_KEY];
}

/** Test-only reset. */
export function resetManagerHostForTests(): void {
	delete registry[HOST_KEY];
}

/** 上游的窗口标题与互斥体名；宿主按产品键派生自己的一套。 */
export function managerIdentity(host: ManagerHost | undefined): {
	windowTitle: string;
	mutexName: string;
} {
	const key = host?.instanceKey.trim().replace(/[^A-Za-z0-9._-]/g, "") || "NarraFork";
	return { windowTitle: `${key} Manager`, mutexName: `Local\\${key}.Manager` };
}
