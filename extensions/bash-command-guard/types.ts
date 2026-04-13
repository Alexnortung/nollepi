export type CommandAllowlist = {
	exact: string[];
	prefixes: string[];
	templates: string[];
};

export type CommandPolicy = {
	allowed: boolean;
	normalizedCommand: string;
	normalizedTokens: string[];
	message: string;
};
