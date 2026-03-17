import { validateRequest } from "@dokploy/server/lib/auth";
import type { GetServerSidePropsContext } from "next";
import type { ReactElement } from "react";
import { SkillAnalyticsDashboard } from "@/components/dashboard/skill-analytics-dashboard";
import { DashboardLayout } from "@/components/layouts/dashboard-layout";

function Page() {
	return (
		<div className="flex flex-col w-full min-h-[calc(100vh-8rem)] p-4 md:p-6 max-w-7xl mx-auto">
			<SkillAnalyticsDashboard />
		</div>
	);
}

Page.getLayout = (page: ReactElement) => <DashboardLayout>{page}</DashboardLayout>;

export default Page;

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
	const { user } = await validateRequest(ctx.req);
	if (!user) {
		return { redirect: { permanent: false, destination: "/" } };
	}
	return { props: {} };
}
