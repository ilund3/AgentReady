"use client";

import dynamic from "next/dynamic";
import { TooltipProvider } from "@inspector/components/ui/tooltip";
import { Toaster } from "@inspector/components/ui/toaster";

// Load the Inspector app only on the client (uses browser APIs / MCP connection state)
const InspectorApp = dynamic(() => import("@inspector/App"), { ssr: false });

export function InspectorView() {
	return (
		<TooltipProvider>
			<div className="h-full min-h-0 flex flex-col bg-background rounded-xl">
				<InspectorApp />
			</div>
			<Toaster />
		</TooltipProvider>
	);
}
