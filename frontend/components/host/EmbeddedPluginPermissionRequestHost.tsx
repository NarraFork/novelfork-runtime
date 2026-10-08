import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { PluginPermissionRequestHost } from "../plugins-admin/PluginPermissionRequestHost";

/**
 * Permission prompt host singleton for embedded surfaces.
 *
 * A Studio window can host several embedded Runtime surfaces at once (the narrator
 * panel and an embedded Runtime settings page). Both would mount the plain
 * PluginPermissionRequestHost as-is, and every host instance shows its own copy of
 * the same prompt when the backend broadcasts a permission request — two identical
 * permission dialogs on screen. This wrapper keeps the component untouched and lets
 * only the first mounted host own the prompt; the rest render nothing until the
 * leader unmounts — the oldest remaining host then takes over, so a permission
 * request is never left unanswered just because the first surface closed.
 */

let mountedHosts: readonly string[] = [];
const listeners = new Set<() => void>();

function currentLeaderId(): string | null {
	return mountedHosts[0] ?? null;
}

function subscribeToLeaderChange(listener: () => void): () => void {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

function notifyLeaderChange(): void {
	for (const listener of listeners) listener();
}

function mountHost(id: string): void {
	mountedHosts = [...mountedHosts, id];
	notifyLeaderChange();
}

function unmountHost(id: string): void {
	if (!mountedHosts.includes(id)) return;
	mountedHosts = mountedHosts.filter((host) => host !== id);
	notifyLeaderChange();
}

let nextHostId = 0;

export function EmbeddedPluginPermissionRequestHost(): ReactNode {
	const [hostId] = useState(() => {
		nextHostId += 1;
		return `embedded-plugin-permission-host-${nextHostId}`;
	});

	useEffect(() => {
		mountHost(hostId);
		return () => unmountHost(hostId);
	}, [hostId]);

	const leaderId = useSyncExternalStore(subscribeToLeaderChange, currentLeaderId, () => null);

	if (leaderId !== hostId) return null;
	return <PluginPermissionRequestHost />;
}
