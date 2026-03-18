import { cn } from "@/lib/utils";

/** Default AgentReady mark (white AR on black) served from `public/agentready-logo.png`. */
export const AGENTREADY_LOGO_SRC = "/agentready-logo.png";

interface Props {
	className?: string;
	logoUrl?: string;
}

export const Logo = ({ className = "size-14", logoUrl }: Props) => {
	const src = logoUrl || AGENTREADY_LOGO_SRC;
	const isCustom = Boolean(logoUrl);

	return (
		<img
			src={src}
			alt={isCustom ? "Organization logo" : "AgentReady"}
			className={cn(
				className,
				"object-contain rounded-md",
				!isCustom && "bg-black p-1",
			)}
		/>
	);
};
