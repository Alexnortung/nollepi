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
    "mitsupi" = {
      url = "github:mitsuhiko/agent-stuff";
      flake = false;
    };
  };

  outputs =
    inputs@{
      self,
      nixpkgs,
      llm-agents,
      ...
    }:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];
      forAllSystems = nixpkgs.lib.genAttrs systems;
      mkPiPackage =
        pkgs: upstreamPi:
        let
          upstreamPackageRoot = "${upstreamPi}/lib/node_modules/@mariozechner/pi-coding-agent";
          usageExtensionSrc = inputs."pi-usage-extension" + "/usage-extension";
          localPackage = builtins.fromJSON (builtins.readFile ./package.json);
          upstreamPackage = builtins.fromJSON (builtins.readFile "${upstreamPackageRoot}/package.json");
          packagedManifest = pkgs.writeText "nollepi-package.json" (
            builtins.toJSON (
              localPackage
              // {
                version = upstreamPackage.version;
              }
            )
          );
        in
        pkgs.runCommand "nollepi-pi-package" { } ''
          mkdir -p "$out/extensions/pi-usage-extension"
          cp -R ${upstreamPackageRoot}/dist "$out/"
          cp -R ${upstreamPackageRoot}/docs "$out/"
          cp -R ${upstreamPackageRoot}/examples "$out/"
          cp ${upstreamPackageRoot}/README.md "$out/README.md"
          cp ${upstreamPackageRoot}/CHANGELOG.md "$out/CHANGELOG.md"
          cp ${packagedManifest} "$out/package.json"
          cp -R ${./extensions}/* "$out/extensions/"
          cp -R ${./skills} "$out/skills"

          mkdir -p "$out/extensions/utils"
          cp ${inputs.mitsupi}/extensions/btw.ts "$out/extensions/utils/btw.ts"
          # Patch btw extension
          sed -i 's/session\.agent\.replaceMessages(seedMessages as typeof session\.state\.messages);/session.agent.state.messages = seedMessages as typeof session.state.messages;/' "$out/extensions/utils/btw.ts"
          cp ${inputs.mitsupi}/extensions/context.ts "$out/extensions/utils/context.ts"

          for file in index.ts package.json README.md CHANGELOG.md LICENSE screenshot.png; do
            if [ ! -e ${usageExtensionSrc}/$file ]; then
              echo "Missing expected pi-usage-extension file: $file" >&2
              exit 1
            fi
          done

          cp -r ${usageExtensionSrc} "$out/extensions/pi-usage-extension/"
        '';
    in
    {
      packages = forAllSystems (
        system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
          upstreamPi = llm-agents.packages.${system}.pi;
        in
        {
          default = mkPiPackage pkgs upstreamPi;
        }
      );

      apps = forAllSystems (
        system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
          upstreamPi = llm-agents.packages.${system}.pi;
          piPackageDir = mkPiPackage pkgs upstreamPi;
          runPi = pkgs.writeShellApplication {
            name = "nollepi";
            runtimeInputs = [ upstreamPi ];
            text = ''
              export PI_PACKAGE_DIR=${piPackageDir}
              # --no-extensions makes sure that we don't load any extensions from the user's envitonment
              exec ${upstreamPi}/bin/pi \
                --no-extensions \
                --extension ${piPackageDir} \
                "$@"
            '';
          };
        in
        {
          default = {
            type = "app";
            program = "${runPi}/bin/nollepi";
          };
        }
      );

      devShells = forAllSystems (
        system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
        in
        {
          default = pkgs.mkShellNoCC {
            packages = [
              pkgs.nodejs
              pkgs.pnpm
              pkgs.tsx
            ];
          };
        }
      );
    };
}
