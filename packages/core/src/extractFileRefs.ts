const FILE_REF_PATTERN = /@([A-Za-z0-9._/-]+)/g;

export function extractFileRefs(prompt: string): string[] {
  const refs: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = FILE_REF_PATTERN.exec(prompt)) !== null) {
    refs.push(match[1]);
  }
  FILE_REF_PATTERN.lastIndex = 0;
  return refs;
}
