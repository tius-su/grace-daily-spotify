import { readFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";

const folders = ["scripts/ind_ayt", "scripts/BSB"];

for (const folder of folders) {
  if (!existsSync(folder)) {
    console.log(`Folder ${folder} does not exist`);
    continue;
  }
  console.log(`Checking folder: ${folder}`);
  const booksFile = join(folder, "books.json");
  if (existsSync(booksFile)) {
    try {
      JSON.parse(readFileSync(booksFile, "utf8"));
    } catch (e) {
      console.error(`Error in ${booksFile}: ${e.message}`);
    }
  }

  const bookDirs = readdirSync(folder, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  for (const bookDir of bookDirs) {
    const fullBookDir = join(folder, bookDir);
    const files = readdirSync(fullBookDir);
    for (const file of files) {
      if (file.endsWith(".json")) {
        const filePath = join(fullBookDir, file);
        try {
          JSON.parse(readFileSync(filePath, "utf8"));
        } catch (e) {
          console.error(`Error in file ${filePath}: ${e.message}`);
        }
      }
    }
  }
}
console.log("Check complete.");
