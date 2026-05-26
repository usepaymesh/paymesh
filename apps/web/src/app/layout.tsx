import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
	title: 'Paymesh',
	description:
		'Provider-agnostic payments infrastructure for TypeScript teams.',
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<body>{children}</body>
		</html>
	);
}
