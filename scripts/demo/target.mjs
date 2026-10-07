export function assertDemoTarget(projectRef) {
  if (projectRef !== "psdrzqbqsvpkjscwirog") {
    throw new Error(
      "Demo seeding is restricted to the GHDB testing project (psdrzqbqsvpkjscwirog).",
    );
  }
}
