import { writeFile } from "node:fs/promises";
import { join } from "node:path";
export async function markForDesktopDiscovery(
  directory: string
): Promise<void> {
  await writeFile(
    join(directory, ".virtual-world-created.json"),
    '{"version":1}\n',
    { encoding: "utf8", flag: "wx" }
  );
}
