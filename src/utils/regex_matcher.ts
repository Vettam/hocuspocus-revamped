class RegexMatcher {
  static uuidRegex: string =
    "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";

  static matchUUID(input: string): boolean {
    return RegExp(this.uuidRegex).test(input);
  }
}

export { RegexMatcher };
