import { describe, expect, it } from 'vitest';
import { ESLint } from 'eslint';
import { fileURLToPath } from 'node:url';

// Real project config: the rule lives in eslint.config.js (#27).
const eslint = new ESLint({ cwd: fileURLToPath(new URL('../..', import.meta.url)) });

async function restricted(code: string): Promise<string[]> {
  const [res] = await eslint.lintText(code, { filePath: 'src/__lint_probe__.tsx' });
  if (!res) throw new Error('ESLint returned no result');
  return res.messages.filter((m) => m.ruleId === 'no-restricted-syntax').map((m) => m.message);
}

const wrap = (attr: string) =>
  `export const X = (c: string, b: string, d: boolean) => <div ${attr} />;\n`;

describe('tailwind class glued to interpolation', () => {
  it.each([
    ['class before ${', 'className={`p-2${c}`}'],
    ['class after }', 'className={`${c}p-2`}'],
    ['class glued after a space-separated class', 'className={`a ${b}c`}'],
    ['glue inside a nested template', "className={`a ${d ? `b${c}` : ''}`}"],
  ])(
    'reports %s',
    async (_n, attr) => {
      const msgs = await restricted(wrap(attr));
      expect(msgs.length).toBeGreaterThan(0);
      expect(msgs[0]).toContain('#27');
    },
    15_000,
  );

  it.each([
    ['space before ${', 'className={`p-2 ${c}`}'],
    ['space after }', 'className={`${c} p-2`}'],
    ['nested ternary template', "className={d ? `a ${d ? 'b' : 'c'}` : 'z'}"],
    ['multiline template', 'className={`a\n  ${c}\n  p-2`}'],
    ['spaced nested template', "className={`a ${d ? `b ${c}` : ''}`}"],
    ['non-className attribute', 'data-x={`a${b}c`}'],
  ])(
    'accepts %s',
    async (_n, attr) => {
      expect(await restricted(wrap(attr))).toEqual([]);
    },
    15_000,
  );
});
