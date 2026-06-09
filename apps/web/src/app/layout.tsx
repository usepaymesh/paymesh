import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Providers } from '../components/providers';
import './globals.css';

const geistSans = Geist({
	subsets: ['latin'],
	variable: '--font-sans',
});

const geistMono = Geist_Mono({
	subsets: ['latin'],
	variable: '--font-mono',
});

export const metadata: Metadata = {
	title: 'Paymesh',
	description: 'Unified payment provider infrastructure for TypeScript teams.',
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html
			className="dark"
			data-scroll-behavior="smooth"
			lang="en"
			suppressHydrationWarning
		>
			<body
				className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
				suppressHydrationWarning
			>
				<Providers>{children}</Providers>
			</body>
		</html>
	);
}
