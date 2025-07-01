#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const REGISTRIES = {
  github: {
    name: "GitHub Packages (Development)",
    registry: "https://npm.pkg.github.com",
    authToken: "GITHUB_TOKEN",
    configFile: ".npmrc.github",
  },
  npmjs: {
    name: "npmjs.org (Production)",
    registry: "https://registry.npmjs.org/",
    authToken: "NPM_TOKEN",
    configFile: ".npmrc.npmjs",
  },
};

function switchRegistry(targetRegistry) {
  if (!REGISTRIES[targetRegistry]) {
    console.error(`❌ Unknown registry: ${targetRegistry}`);
    console.log("Available registries:");
    Object.keys(REGISTRIES).forEach((key) => {
      console.log(`  - ${key}: ${REGISTRIES[key].name}`);
    });
    process.exit(1);
  }

  const config = REGISTRIES[targetRegistry];
  console.log(`🔄 Switching to ${config.name}...`);

  // Copy the appropriate .npmrc file
  const sourceFile = path.join(process.cwd(), config.configFile);
  const targetFile = path.join(process.cwd(), ".npmrc");

  if (!fs.existsSync(sourceFile)) {
    console.error(`❌ Configuration file not found: ${config.configFile}`);
    process.exit(1);
  }

  fs.copyFileSync(sourceFile, targetFile);
  console.log(`✅ Switched to ${config.name}`);
  console.log(`📝 Using registry: ${config.registry}`);
  console.log(`🔑 Using token: ${config.authToken}`);
  console.log("");
  console.log("Next steps:");
  console.log(`1. Set your ${config.authToken} environment variable`);
  console.log(`2. Run: pnpm switch-registry update ${targetRegistry}`);
  console.log(`3. Run: pnpm update-workspace-deps update ${targetRegistry}`);
  console.log("4. Build and publish your packages");
}

function updatePackageConfigs(targetRegistry) {
  if (!REGISTRIES[targetRegistry]) {
    console.error(`❌ Unknown registry: ${targetRegistry}`);
    process.exit(1);
  }

  const config = REGISTRIES[targetRegistry];
  console.log(`🔄 Updating package configurations for ${config.name}...`);

  // Function to recursively find all package.json files
  function findPackageJsonFiles(dir) {
    const files = [];
    const items = fs.readdirSync(dir);

    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory() && !item.startsWith(".") && item !== "node_modules") {
        if (item === "packages" || item === "examples") {
          const subItems = fs.readdirSync(fullPath);
          for (const subItem of subItems) {
            const subFullPath = path.join(fullPath, subItem);
            const subStat = fs.statSync(subFullPath);
            if (subStat.isDirectory()) {
              const packageJsonPath = path.join(subFullPath, "package.json");
              if (fs.existsSync(packageJsonPath)) {
                files.push(packageJsonPath);
              }
            }
          }
        } else {
          files.push(...findPackageJsonFiles(fullPath));
        }
      }
    }

    return files;
  }

  // Update package.json files
  const rootDir = process.cwd();
  const packageJsonFiles = findPackageJsonFiles(rootDir);

  packageJsonFiles.forEach((filePath) => {
    const content = fs.readFileSync(filePath, "utf8");
    const packageJson = JSON.parse(content);

    if (packageJson.name?.startsWith("@voltagent/")) {
      // Update publishConfig
      if (!packageJson.publishConfig) {
        packageJson.publishConfig = {};
      }
      packageJson.publishConfig.registry = config.registry;

      // Update repository URL based on registry
      if (!packageJson.repository) {
        packageJson.repository = {};
      }

      if (targetRegistry === "github") {
        packageJson.repository.url = "https://github.com/myrrakh/voltagent.git";
      } else {
        packageJson.repository.url = "https://github.com/voltagent/voltagent.git";
      }

      fs.writeFileSync(filePath, `${JSON.stringify(packageJson, null, 2)}\n`);
      console.log(`✅ Updated ${filePath}`);
    }
  });

  console.log(`✅ All package configurations updated for ${config.name}`);
}

// Main execution
const args = process.argv.slice(2);
const command = args[0];
const registry = args[1];

if (!command) {
  console.log("🔧 Registry Switcher for VoltAgent");
  console.log("");
  console.log("Usage:");
  console.log("  node scripts/switch-registry.js switch <registry>");
  console.log("  node scripts/switch-registry.js update <registry>");
  console.log("");
  console.log("Available registries:");
  Object.keys(REGISTRIES).forEach((key) => {
    console.log(`  - ${key}: ${REGISTRIES[key].name}`);
  });
  console.log("");
  console.log("Examples:");
  console.log("  node scripts/switch-registry.js switch github");
  console.log("  node scripts/switch-registry.js switch npmjs");
  console.log("  node scripts/switch-registry.js update github");
  console.log("  node scripts/switch-registry.js update npmjs");
  process.exit(0);
}

if (command === "switch") {
  if (!registry) {
    console.error("❌ Please specify a registry to switch to");
    process.exit(1);
  }
  switchRegistry(registry);
} else if (command === "update") {
  if (!registry) {
    console.error("❌ Please specify a registry to update for");
    process.exit(1);
  }
  updatePackageConfigs(registry);
} else {
  console.error(`❌ Unknown command: ${command}`);
  process.exit(1);
}
