/** Tiny `--flag value` parser for the CLIs. */
export function parseArgs(argv: string[]): Map<string, string> {
  const args = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (key?.startsWith("--")) {
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        args.set(key.slice(2), next);
        i++;
      } else {
        args.set(key.slice(2), "true");
      }
    }
  }
  return args;
}
