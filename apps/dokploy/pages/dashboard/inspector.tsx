import { validateRequest } from "@dokploy/server/lib/auth";
import type { GetServerSidePropsContext } from "next";
import type { ReactElement } from "react";
import { DashboardLayout } from "@/components/layouts/dashboard-layout";
import { InspectorView } from "@/components/dashboard/inspector-view";

/**
 * MCP Inspector – test and debug MCP servers.
 * Fully integrated into the dashboard (same app, no iframe).
 * Run the Inspector proxy (pnpm inspector-server:dev) for stdio/local MCP connections.
 */
function InspectorPage() {
	return (
		<div className="flex flex-col w-full h-[calc(100vh-8rem)] min-h-[500px]">
			<div className="flex-1 flex flex-col min-h-0 overflow-hidden rounded-xl border bg-card">
				<InspectorView />
			</div>
		</div>
	);
}

InspectorPage.getLayout = (page: ReactElement) => (
	<DashboardLayout>{page}</DashboardLayout>
);

export default InspectorPage;

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
	const { user } = await validateRequest(ctx.req);
	if (!user) {
		return {
			redirect: {
				permanent: true,
				destination: "/",
			},
		};
	}
	return { props: {} };
}
