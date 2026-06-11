export interface PaymeshMCPToolsOptions {
	pix?: boolean;
	customers?: boolean;
	payments?: boolean;
	subscriptions?: boolean;
}

export interface PaymeshMCPOptions {
	enabled?: boolean;
	readonly?: boolean;
	maxListLimit?: number;
	includeRaw?: boolean;
	allowLiveMode?: boolean;
	tools?: PaymeshMCPToolsOptions;
}

export type PaymeshMCPMetadata = Required<PaymeshMCPOptions>;
