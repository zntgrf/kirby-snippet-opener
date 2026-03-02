export function getSnippetRegex(): RegExp {
  return /snippet\(\s*(['"])([^'"]+)\1[\s\S]*?\)/g;
}
