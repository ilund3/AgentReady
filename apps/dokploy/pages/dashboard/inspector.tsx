import { validateRequest } from "@dokploy/server/lib/auth";
import type { GetServerSidePropsContext } from "next";
import type { ReactElement } from "react";
import { DashboardLayout } from "@/components/layouts/dashboard-layout";
import { Card } from "@/components/ui/card";

/**
 * MCP Inspector – test and debug MCP servers.
 * The Inspector UI is built from apps/inspector-client and served at /inspector/.
 * Run the Inspector proxy (pnpm inspector-server:dev) for stdio/local MCP connections.
 */
function InspectorPage() {
	return (
		<div className="flex flex-col w-full h-[calc(100vh-8rem)] min-h-[500px]">
			<Card className="flex-1 flex flex-col min-h-0 p-0 overflow-hidden bg-sidebar rounded-xl">
				<iframe
					title="MCP Inspector"
					src="/inspector/"
					className="w-full h-full min-h-[480px] rounded-xl border-0 bg-background"
				/>
			</Card>
		</div>
	);
}

InspectorPage.getLayout = (page: ReactElement) => (
	<DashboardLayout>{page}</DashboardLayout>
);

export default InspectorPage;

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
	return validateRequest(ctx);
}
