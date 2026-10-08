import { Box } from "@mantine/core";
import type { ReactNode } from "react";
import { useNarrator } from "../../hooks/useNarrator";
import { getInitialNamespaces } from "../../lib/i18n";
import { RuntimeFrontendHostProviders } from "../host/RuntimeFrontendHostProviders";
import { NarratorDock } from "./dock/NarratorDock";
import { NarratorDockProvider } from "./dock/NarratorDockContext";
import {
	type RuntimeFileOpenInterceptor,
	RuntimeFileOpenInterceptorProvider,
} from "./RuntimeFileOpenInterceptorContext";
import {
	type RuntimeToolResultRenderer,
	RuntimeToolResultRendererProvider,
} from "./RuntimeToolResultRendererContext";

const runtimeNamespaces = [
	...getInitialNamespaces("/narrators/current"),
	"common",
	"narrator",
	"narrators",
	"chapters",
	"settings",
	"terminal",
	"git",
] as const;

export interface EmbeddedNarratorDockHostProps {
	readonly narratorId: string;
	readonly highlightMessageId?: string;
	readonly onForkFromMessage?: (messageUuid: string) => void;
	readonly compact?: boolean;
	readonly toolResultRenderer?: RuntimeToolResultRenderer;
	/** Lets the host open some files in its own editor; see RuntimeFileOpenInterceptorContext. */
	readonly onOpenFile?: RuntimeFileOpenInterceptor;
	/** Host-resolved color scheme; see RuntimeFrontendHostProviders. */
	readonly colorScheme?: "light" | "dark";
}

function EmbeddedNarratorDockSurface({
	narratorId,
	highlightMessageId,
	onForkFromMessage,
}: Pick<
	EmbeddedNarratorDockHostProps,
	"narratorId" | "highlightMessageId" | "onForkFromMessage"
>): ReactNode {
	const { data: narrator } = useNarrator(narratorId);
	const chapterId =
		typeof (narrator as { chapterId?: unknown } | undefined)?.chapterId ===
		"string"
			? (narrator as { chapterId: string }).chapterId
			: null;

	return (
		<Box
			data-runtime-embedded-narrator-dock=""
			style={{
				height: "100%",
				width: "100%",
				position: "relative",
				overflow: "hidden",
				isolation: "isolate",
			}}
		>
			<NarratorDockProvider
				key={narratorId}
				narratorId={narratorId}
				chapterId={chapterId}
				onForkFromMessage={chapterId ? (onForkFromMessage ?? null) : null}
				highlightMessageId={highlightMessageId}
			>
				<NarratorDock device="desktop" />
			</NarratorDockProvider>
		</Box>
	);
}

/**
 * Embeds the Runtime-owned narrator dock into any compatible React host without
 * importing product packages or depending on product persistence.
 */
export function EmbeddedNarratorDockHost({
	narratorId,
	highlightMessageId,
	onForkFromMessage,
	toolResultRenderer,
	onOpenFile,
	colorScheme,
}: EmbeddedNarratorDockHostProps): ReactNode {
	return (
		<RuntimeFrontendHostProviders
			namespaces={runtimeNamespaces}
			colorScheme={colorScheme}
			loadingFallback={
				<div
					role="status"
					style={{
						display: "grid",
						height: "100%",
						minHeight: 160,
						placeItems: "center",
					}}
				>
					Loading narrator…
				</div>
			}
		>
			<RuntimeToolResultRendererProvider value={toolResultRenderer ?? null}>
				<RuntimeFileOpenInterceptorProvider value={onOpenFile ?? null}>
					<EmbeddedNarratorDockSurface
						narratorId={narratorId}
						highlightMessageId={highlightMessageId}
						onForkFromMessage={onForkFromMessage}
					/>
				</RuntimeFileOpenInterceptorProvider>
			</RuntimeToolResultRendererProvider>
		</RuntimeFrontendHostProviders>
	);
}
