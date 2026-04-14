export type CommandAllowlist = {
	exact: string[];
	prefixes: string[];
	templates: string[];
};

export type CommandSegmentPolicy = {
	command: string;
	normalizedCommand: string;
	normalizedTokens: string[];
	allowed: boolean;
};

export type CommandPolicy = {
	allowed: boolean;
	normalizedCommand: string;
	normalizedTokens: string[];
	message: string;
	segments: CommandSegmentPolicy[];
};
