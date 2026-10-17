import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useCurrentUser } from "../../../hooks/useAuth";
import {
	findSettingsHostPage,
	useSettingsHostExtension,
} from "../../../lib/settings-host-extension";

/**
 * A settings page supplied by the embedding product (see settings-host-extension).
 * Unknown ids — always the case in standalone Runtime, which has no extension — go to
 * the profile page rather than rendering an empty pane.
 */
export const Route = createFileRoute("/settings/host/$pageId")({
	component: SettingsHostPageRoute,
});

function SettingsHostPageRoute() {
	const { pageId } = Route.useParams();
	const extension = useSettingsHostExtension();
	const { data: user } = useCurrentUser();
	const page = findSettingsHostPage(extension, pageId);

	if (!page) return <Navigate to="/settings/profile" replace />;
	if (page.adminOnly && user && user.role !== "admin") {
		return <Navigate to="/settings/profile" replace />;
	}
	return <page.Component />;
}
