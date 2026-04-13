{
  description = "Pi package for the nollepi extensions";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    llm-agents = {
      url = "github:numtide/llm-agents.nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    "pi-usage-extension" = {
      url = "github:tmustier/pi-extensions";
      flake = false;
    };
  };

  outputs = inputs@{ self, nixpkgs, llm-agents, ... }:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];
      forAllSystems = nixpkgs.lib.genAttrs systems;
    in
    {
      packages = forAllSystems (system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
          upstreamPi = llm-agents.packages.${system}.pi;
          upstreamPackageRoot = "${upstreamPi}/lib/node_modules/@mariozechner/pi-coding-agent";
          usageExtensionSrc = inputs."pi-usage-extension" + "/usage-extension";
          piPackageDir = pkgs.runCommand "nollepi-pi-package" { } ''
            mkdir -p "$out/extensions/pi-usage-extension"
            cp -R ${upstreamPackageRoot}/dist "$out/"
            cp -R ${upstreamPackageRoot}/docs "$out/"
            cp -R ${upstreamPackageRoot}/examples "$out/"
            cp ${upstreamPackageRoot}/README.md "$out/README.md"
            cp ${upstreamPackageRoot}/CHANGELOG.md "$out/CHANGELOG.md"
            cp ${./package.json} "$out/package.json"
            cp -R ${./extensions}/* "$out/extensions/"

            for file in index.ts package.json README.md CHANGELOG.md LICENSE screenshot.png; do
              if [ ! -e ${usageExtensionSrc}/$file ]; then
                echo "Missing expected pi-usage-extension file: $file" >&2
                exit 1
              fi
            done

            cp ${usageExtensionSrc}/index.ts "$out/extensions/pi-usage-extension/index.ts"
            cp ${usageExtensionSrc}/package.json "$out/extensions/pi-usage-extension/package.json"
            cp ${usageExtensionSrc}/README.md "$out/extensions/pi-usage-extension/README.md"
            cp ${usageExtensionSrc}/CHANGELOG.md "$out/extensions/pi-usage-extension/CHANGELOG.md"
            cp ${usageExtensionSrc}/LICENSE "$out/extensions/pi-usage-extension/LICENSE"
            cp ${usageExtensionSrc}/screenshot.png "$out/extensions/pi-usage-extension/screenshot.png"
          '';
        in
        {
          default = piPackageDir;
        });

      apps = forAllSystems (system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
          upstreamPi = llm-agents.packages.${system}.pi;
          piPackageDir = self.packages.${system}.default;
          runPi = pkgs.writeShellApplication {
            name = "nollepi";
            runtimeInputs = [ upstreamPi ];
            text = ''
              export PI_PACKAGE_DIR=${piPackageDir}
              exec ${upstreamPi}/bin/pi --extension ${piPackageDir} "$@"
            '';
          };
        in
        {
          default = {
            type = "app";
            program = "${runPi}/bin/nollepi";
          };
        });

      devShells = forAllSystems (system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
        in
        {
          default = pkgs.mkShellNoCC {
            packages = [
              pkgs.nodejs
              pkgs.tsx
            ];
          };
        });
    };
}
