import { validateRequest } from "@dokploy/server/lib/auth";
import type { GetServerSidePropsContext } from "next";
import type { ReactElement } from "react";
import { DashboardLayout } from "@/components/layouts/dashboard-layout";
import { SkillInspectorView } from "@/components/dashboard/skill-inspector-view";

/**
 * Skill Inspector – build skills for Claude (Anthropic Skills).
 * Based on "The Complete Guide to Building Skills for Claude": SKILL.md structure,
 * frontmatter, instructions, validation, and export.
 */
function SkillInspectorPage() {
	return (
		<div className="flex flex-col w-full h-[calc(100vh-8rem)] min-h-[500px]">
			<div className="flex-1 flex flex-col min-h-0 overflow-hidden rounded-xl border bg-card">
				<SkillInspectorView />
			</div>
		</div>
	);
}

SkillInspectorPage.getLayout = (page: ReactElement) => (
	<DashboardLayout>{page}</DashboardLayout>
);

export default SkillInspectorPage;

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
