{
  description = "Pi package for the nollepi extensions";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    llm-agents = {
      url = "github:numtide/llm-agents.nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = { self, nixpkgs, llm-agents, ... }:
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
          piPackageDir = pkgs.runCommand "nollepi-pi-package" { } ''
            mkdir -p "$out"
            cp ${./package.json} "$out/package.json"
            cp -R ${./extensions} "$out/extensions"
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
              exec ${upstreamPi}/bin/pi "$@"
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
