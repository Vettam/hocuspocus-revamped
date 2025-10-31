class RegexMatcher {
  static uuidRegex: string =
    "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";

  // Matches a string that is exactly a UUID
  static matchUUID(input: string): boolean {
    const re = new RegExp(`^${this.uuidRegex}$`);
    return re.test(input);
  }

  // Matches a string that is exactly <uuid>:<uuid>
  static matchUUIDPair(input: string): boolean {
    const re = new RegExp(`^${this.uuidRegex}:${this.uuidRegex}$`);
    return re.test(input);
  }
}

export { RegexMatcher };
