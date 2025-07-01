#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

// Function to recursively find all package.json files
function findPackageJsonFiles(dir) {
  const files = [];
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory() && !item.startsWith(".") && item !== "node_modules") {
      if (item === "packages" || item === "examples" || item === "apps") {
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

// Function to update workspace dependencies
function updateWorkspaceDeps() {
  console.log("🔄 Updating workspace dependencies");

  const rootDir = process.cwd();
  const packageJsonFiles = findPackageJsonFiles(rootDir);

  // First pass: collect all package versions
  const packageVersions = new Map();

  packageJsonFiles.forEach((filePath) => {
    const content = fs.readFileSync(filePath, "utf8");
    const packageJson = JSON.parse(content);

    if (packageJson.name?.startsWith("@voltagent/")) {
      packageVersions.set(packageJson.name, packageJson.version);
    }
  });

  console.log("📦 Found packages:");
  packageVersions.forEach((version, name) => {
    console.log(`  - ${name}: ${version}`);
  });

  // Second pass: update workspace dependencies
  let updatedCount = 0;

  packageJsonFiles.forEach((filePath) => {
    const content = fs.readFileSync(filePath, "utf8");
    const packageJson = JSON.parse(content);
    let updated = false;

    // Update dependencies
    if (packageJson.dependencies) {
      for (const [depName, depVersion] of Object.entries(packageJson.dependencies)) {
        if (depVersion === "workspace:*" && packageVersions.has(depName)) {
          const actualVersion = packageVersions.get(depName);
          packageJson.dependencies[depName] = `^${actualVersion}`;
          console.log(
            `✅ Updated dependency: ${depName} -> ^${actualVersion} in ${packageJson.name}`,
          );
          updated = true;
        }
      }
    }

    // Update devDependencies
    if (packageJson.devDependencies) {
      for (const [depName, depVersion] of Object.entries(packageJson.devDependencies)) {
        if (depVersion === "workspace:*" && packageVersions.has(depName)) {
          const actualVersion = packageVersions.get(depName);
          packageJson.devDependencies[depName] = `^${actualVersion}`;
          console.log(
            `✅ Updated devDependency: ${depName} -> ^${actualVersion} in ${packageJson.name}`,
          );
          updated = true;
        }
      }
    }

    // Update peerDependencies
    // if (packageJson.peerDependencies) {
    //     for (const [depName, depVersion] of Object.entries(packageJson.peerDependencies)) {
    //         if (depVersion === 'workspace:*' && packageVersions.has(depName)) {
    //             const actualVersion = packageVersions.get(depName);
    //             packageJson.peerDependencies[depName] = `^${actualVersion}`;
    //             console.log(`✅ Updated peerDependency: ${depName} -> ^${actualVersion} in ${packageJson.name}`);
    //             updated = true;
    //         }
    //     }
    // }

    if (updated) {
      fs.writeFileSync(filePath, `${JSON.stringify(packageJson, null, 2)}\n`);
      updatedCount++;
    }
  });

  console.log(`\n✅ Updated ${updatedCount} package.json files`);
  console.log("📝 All workspace:* dependencies have been updated to use actual versions");
}

// Function to restore workspace dependencies
function restoreWorkspaceDeps() {
  console.log("🔄 Restoring workspace dependencies...");

  const rootDir = process.cwd();
  const packageJsonFiles = findPackageJsonFiles(rootDir);

  let restoredCount = 0;

  packageJsonFiles.forEach((filePath) => {
    const content = fs.readFileSync(filePath, "utf8");
    const packageJson = JSON.parse(content);
    let restored = false;

    // Restore dependencies
    if (packageJson.dependencies) {
      for (const [depName, depVersion] of Object.entries(packageJson.dependencies)) {
        if (depName.startsWith("@voltagent/")) {
          packageJson.dependencies[depName] = "workspace:*";
          console.log(`✅ Restored dependency: ${depName} -> workspace:* in ${packageJson.name}`);
          restored = true;
        }
      }
    }

    // Restore devDependencies
    if (packageJson.devDependencies) {
      for (const [depName, depVersion] of Object.entries(packageJson.devDependencies)) {
        if (depName.startsWith("@voltagent/")) {
          packageJson.devDependencies[depName] = "workspace:*";
          console.log(
            `✅ Restored devDependency: ${depName} -> workspace:* in ${packageJson.name}`,
          );
          restored = true;
        }
      }
    }

    // Restore peerDependencies
    // if (packageJson.peerDependencies) {
    //     for (const [depName, depVersion] of Object.entries(packageJson.peerDependencies)) {
    //         if (depName.startsWith('@voltagent/')) {
    //             packageJson.peerDependencies[depName] = 'workspace:*';
    //             console.log(`✅ Restored peerDependency: ${depName} -> workspace:* in ${packageJson.name}`);
    //             restored = true;
    //         }
    //     }
    // }

    if (restored) {
      fs.writeFileSync(filePath, `${JSON.stringify(packageJson, null, 2)}\n`);
      restoredCount++;
    }
  });

  console.log(`\n✅ Restored ${restoredCount} package.json files`);
  console.log("🔧 All @voltagent dependencies restored to workspace:*");
}

// Main execution
const args = process.argv.slice(2);
const command = args[0];

if (!command) {
  console.log("🔧 Workspace Dependencies Manager for VoltAgent");
  console.log("");
  console.log("Usage:");
  console.log("  node scripts/update-workspace-deps.js update");
  console.log("  node scripts/update-workspace-deps.js restore");
  console.log("");
  console.log("Commands:");
  console.log("  update  - Update workspace:* to actual versions for publishing");
  console.log("  restore            - Restore actual versions back to workspace:*");
  console.log("");
  console.log("Examples:");
  console.log("  node scripts/update-workspace-deps.js update");
  console.log("  node scripts/update-workspace-deps.js restore");
  process.exit(0);
}

if (command === "update") {
  updateWorkspaceDeps();
} else if (command === "restore") {
  restoreWorkspaceDeps();
} else {
  console.error(`❌ Unknown command: ${command}`);
  process.exit(1);
}
