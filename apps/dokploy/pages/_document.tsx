import { Head, Html, Main, NextScript } from "next/document";

export default function Document() {
	return (
		<Html lang="en" className="font-sans">
			<Head>
				<link rel="icon" href="/agentready-logo.png" type="image/png" />
				<link rel="apple-touch-icon" href="/agentready-logo.png" />
			</Head>
			<body className="flex h-full w-full flex-col font-sans">
				<Main />
				<NextScript />
			</body>
		</Html>
	);
}
